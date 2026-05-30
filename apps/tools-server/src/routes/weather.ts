import type { FastifyInstance } from 'fastify'
import { err } from '../types/api.js'

// WMO weather codes → description + icon
function decodeWeatherCode(code: number): { condition: string; icon: string } {
    if (code === 0) return { condition: 'Ciel dégagé', icon: '☀️' }
    if (code === 1) return { condition: 'Principalement dégagé', icon: '🌤' }
    if (code === 2) return { condition: 'Partiellement nuageux', icon: '⛅' }
    if (code === 3) return { condition: 'Couvert', icon: '☁️' }
    if (code <= 49) return { condition: 'Brouillard', icon: '🌫' }
    if (code <= 59) return { condition: 'Bruine', icon: '🌦' }
    if (code <= 69) return { condition: 'Pluie', icon: '🌧' }
    if (code <= 79) return { condition: 'Neige', icon: '❄️' }
    if (code <= 84) return { condition: 'Averses', icon: '🌦' }
    if (code <= 94) return { condition: 'Orage', icon: '⛈' }
    return { condition: 'Orage violent', icon: '🌩' }
}

export async function registerWeather(fastify: FastifyInstance) {
    fastify.get('/tools/weather', async (req, reply) => {
        const { location, units = 'metric', days = '1' } = req.query as any
        if (!location) return reply.status(400).send(err('INVALID_PARAMS', 'location is required'))

        const numDays = Math.max(1, Math.min(3, parseInt(days)))
        const isImperial = units === 'imperial'

        try {
            // Step 1: Geocode
            const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=fr`,
                { signal: AbortSignal.timeout(10000) }
            )
            if (!geoRes.ok)
                return reply
                    .status(502)
                    .send(err('UPSTREAM_ERROR', `Geocoding failed: HTTP ${geoRes.status}`))
            const geoData: any = await geoRes.json()
            const place = geoData.results?.[0]
            if (!place)
                return reply.status(404).send(err('NOT_FOUND', `Lieu introuvable : ${location}`))

            const { latitude, longitude, name, country } = place

            // Step 2: Weather
            const tempUnit = isImperial ? 'fahrenheit' : 'celsius'
            const windUnit = isImperial ? 'mph' : 'kmh'
            const weatherRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
                    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code` +
                    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
                    `&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}` +
                    `&forecast_days=${numDays}&timezone=auto`,
                { signal: AbortSignal.timeout(10000) }
            )
            if (!weatherRes.ok)
                return reply
                    .status(502)
                    .send(err('UPSTREAM_ERROR', `Weather fetch failed: HTTP ${weatherRes.status}`))
            const w: any = await weatherRes.json()

            const current = w.current
            if (!current)
                return reply.status(502).send(err('UPSTREAM_ERROR', 'No current weather data'))

            const temp = Math.round(current.temperature_2m)
            const feelsLike = Math.round(current.apparent_temperature)
            const humidity = current.relative_humidity_2m
            const wind = Math.round(current.wind_speed_10m)
            const { condition, icon } = decodeWeatherCode(current.weather_code)
            const unit = isImperial ? '°F' : '°C'
            const windUnitLabel = isImperial ? 'mph' : 'km/h'
            const cityLabel = `${name}${country ? `, ${country}` : ''}`

            const forecast = (w.daily?.time ?? [])
                .slice(0, numDays)
                .map((date: string, i: number) => ({
                    date,
                    max_c: w.daily.temperature_2m_max[i],
                    min_c: w.daily.temperature_2m_min[i],
                    ...decodeWeatherCode(w.daily.weather_code[i]),
                    rain_chance: w.daily.precipitation_probability_max[i]
                }))

            const result = `${cityLabel} : ${temp}${unit}, ${condition}. Ressenti ${feelsLike}${unit}, humidité ${humidity}%, vent ${wind} ${windUnitLabel}.`

            return reply.send({
                result,
                panel: {
                    type: 'weather',
                    data: {
                        city: cityLabel,
                        temp,
                        feels_like: feelsLike,
                        condition,
                        humidity,
                        wind,
                        icon,
                        forecast
                    }
                }
            })
        } catch (e: any) {
            return reply.status(502).send(err('UPSTREAM_ERROR', e.message))
        }
    })
}
