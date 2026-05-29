import type { FastifyInstance } from 'fastify'
import { ok, err } from '../types/api.js'

export async function registerWeather(fastify: FastifyInstance) {
    fastify.get('/tools/weather', async (req, reply) => {
        const { location, units = 'metric', days = '1' } = req.query as any
        if (!location) return reply.status(400).send(err('INVALID_PARAMS', 'location is required'))

        const numDays = Math.max(1, Math.min(3, parseInt(days)))
        const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`

        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
            if (!res.ok) return reply.status(502).send(err('UPSTREAM_ERROR', `wttr.in returned HTTP ${res.status}`))

            const raw: any = await res.json()
            const current = raw.current_condition?.[0]
            const toC = (s: string) => parseFloat(s)
            const toF = (s: string) => (parseFloat(s) * 9) / 5 + 32

            const tempField = units === 'imperial' ? 'temp_F' : 'temp_C'
            const feelsField = units === 'imperial' ? 'FeelsLikeF' : 'FeelsLikeC'
            const windField = units === 'imperial' ? 'windspeedMiles' : 'windspeedKmph'

            const currentData = {
                temp_c: units === 'imperial' ? toF(current?.[tempField]) : toC(current?.[tempField]),
                feels_like_c: units === 'imperial' ? toF(current?.[feelsField]) : toC(current?.[feelsField]),
                condition: current?.weatherDesc?.[0]?.value ?? '',
                humidity: parseInt(current?.humidity ?? '0'),
                wind_kmh: parseFloat(current?.[windField] ?? '0'),
            }

            const forecast = (raw.weather ?? []).slice(0, numDays).map((day: any) => ({
                date: day.date,
                max_c: units === 'imperial' ? toF(day.maxtempF) : toC(day.maxtempC),
                min_c: units === 'imperial' ? toF(day.mintempF) : toC(day.mintempC),
                condition: day.hourly?.[4]?.weatherDesc?.[0]?.value ?? '',
                rain_chance: parseInt(day.hourly?.[4]?.chanceofrain ?? '0'),
            }))

            return reply.send(ok({ location, current: currentData, forecast }))
        } catch (e: any) {
            return reply.status(502).send(err('UPSTREAM_ERROR', e.message))
        }
    })
}
