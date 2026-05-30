// French TTS text normalization — converts written forms to natural spoken French

const ORDINALS: Record<number, string> = {
    1: 'premier',
    2: 'deuxième',
    3: 'troisième',
    4: 'quatrième',
    5: 'cinquième',
    6: 'sixième',
    7: 'septième',
    8: 'huitième',
    9: 'neuvième',
    10: 'dixième'
}

const MONTHS: Record<number, string> = {
    1: 'janvier',
    2: 'février',
    3: 'mars',
    4: 'avril',
    5: 'mai',
    6: 'juin',
    7: 'juillet',
    8: 'août',
    9: 'septembre',
    10: 'octobre',
    11: 'novembre',
    12: 'décembre'
}

// Acronyms pronounced as words — do NOT spell out
const WORD_ACRONYMS = new Set(['NASA', 'UNESCO', 'ONU', 'OMS', 'OTAN'])

function numberToFrench(n: number): string {
    if (n === 0) return 'zéro'
    if (n < 0) return 'moins ' + numberToFrench(-n)

    const ones = [
        '',
        'un',
        'deux',
        'trois',
        'quatre',
        'cinq',
        'six',
        'sept',
        'huit',
        'neuf',
        'dix',
        'onze',
        'douze',
        'treize',
        'quatorze',
        'quinze',
        'seize',
        'dix-sept',
        'dix-huit',
        'dix-neuf'
    ]
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

    function below100(x: number): string {
        if (x < 20) return ones[x]
        if (x < 70) {
            const t = Math.floor(x / 10)
            const u = x % 10
            return tens[t] + (u === 1 ? ' et un' : u > 0 ? '-' + ones[u] : '')
        }
        if (x < 80) {
            const u = x - 60
            return 'soixante' + (u === 11 ? ' et onze' : '-' + below100(u))
        }
        if (x < 90) {
            const u = x - 80
            return 'quatre-vingt' + (u === 0 ? 's' : '-' + ones[u])
        }
        // 90-99
        const u = x - 90
        return 'quatre-vingt-' + below100(10 + u)
    }

    function below1000(x: number): string {
        if (x < 100) return below100(x)
        const h = Math.floor(x / 100)
        const r = x % 100
        const prefix = h === 1 ? 'cent' : below100(h) + ' cent' + (r === 0 && h > 1 ? 's' : '')
        return r === 0 ? prefix : prefix + ' ' + below100(r)
    }

    if (n < 1000) return below1000(n)
    if (n < 2000) return 'mille' + (n > 1000 ? ' ' + below1000(n - 1000) : '')
    if (n < 1000000) {
        const t = Math.floor(n / 1000)
        const r = n % 1000
        return below1000(t) + ' mille' + (r > 0 ? ' ' + below1000(r) : '')
    }
    if (n < 1000000000) {
        const m = Math.floor(n / 1000000)
        const r = n % 1000000
        return (
            (m === 1 ? 'un million' : below1000(m) + ' millions') +
            (r > 0 ? ' ' + numberToFrench(r) : '')
        )
    }
    return String(n)
}

function normalizeTime(t: string): string {
    // 12h30min → 12 heures 30, 8h → 8 heures, 1h30 → 1 heure 30
    t = t.replace(/\b(\d{1,2})h(\d{2})(?:min)?\b/gi, (_m, h, min) => {
        const hNum = parseInt(h)
        const mNum = parseInt(min)
        const hWord = hNum <= 1 ? 'heure' : 'heures'
        return mNum === 0 ? `${hNum} ${hWord}` : `${hNum} ${hWord} ${mNum}`
    })
    t = t.replace(/\b(\d{1,2})[hH]\b/g, (_m, h) => {
        const hNum = parseInt(h)
        return `${hNum} ${hNum <= 1 ? 'heure' : 'heures'}`
    })
    t = t.replace(/\b(\d+)min\b/gi, (_m, n) => `${n} minutes`)
    t = t.replace(/\b(\d+)s\b(?!\w)/g, (_m, n) => `${n} secondes`)
    return t
}

function normalizeDates(t: string): string {
    // DD/MM/YYYY or DD/MM
    t = t.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g, (_m, d, mo, y) => {
        const day = parseInt(d)
        const month = parseInt(mo)
        if (month < 1 || month > 12) return _m
        const dayStr = day === 1 ? 'premier' : String(day)
        const monthStr = MONTHS[month]
        return y ? `${dayStr} ${monthStr} ${y}` : `${dayStr} ${monthStr}`
    })
    // Ordinals: 1er, 2ème, 3e, etc.
    t = t.replace(/\b(\d+)(?:ème|eme|er|e)\b/gi, (_m, n) => {
        const num = parseInt(n)
        return ORDINALS[num] ?? numberToFrench(num) + 'ième'
    })
    return t
}

function normalizeCurrency(t: string): string {
    // 3,50€ → 3 euros 50
    t = t.replace(/(\d+)[,.](\d{2})\s*€/g, (_m, int, dec) => {
        const cents = parseInt(dec)
        return cents === 0 ? `${int} euros` : `${int} euros ${cents}`
    })
    // 0,99€ → 99 centimes
    t = t.replace(/\b0[,.](\d{2})\s*€/g, (_m, cents) => `${parseInt(cents)} centimes`)
    // 50€ → 50 euros
    t = t.replace(/(\d+)\s*€/g, '$1 euros')
    // $100 or 100$
    t = t.replace(/\$\s*(\d+)/g, '$1 dollars')
    t = t.replace(/(\d+)\s*\$/g, '$1 dollars')
    // £50
    t = t.replace(/£\s*(\d+)/g, '$1 livres')
    t = t.replace(/(\d+)\s*£/g, '$1 livres')
    return t
}

function normalizeUnits(t: string): string {
    const units: [RegExp, string][] = [
        [/\b(\d+(?:[,.]\d+)?)\s*km\/h\b/gi, '$1 kilomètres par heure'],
        [/\b(\d+(?:[,.]\d+)?)\s*mph\b/gi, '$1 miles par heure'],
        [/\b(\d+(?:[,.]\d+)?)\s*km\b/gi, '$1 kilomètres'],
        [/\b(\d+(?:[,.]\d+)?)\s*cm\b/gi, '$1 centimètres'],
        [/\b(\d+(?:[,.]\d+)?)\s*mm\b/gi, '$1 millimètres'],
        [/\b(\d+(?:[,.]\d+)?)\s*m\b(?!\w)/gi, '$1 mètres'],
        [/\b(\d+(?:[,.]\d+)?)\s*kg\b/gi, '$1 kilogrammes'],
        [/\b(\d+(?:[,.]\d+)?)\s*g\b(?!\w)/gi, '$1 grammes'],
        [/\b(\d+(?:[,.]\d+)?)\s*mg\b/gi, '$1 milligrammes'],
        [/\b(\d+(?:[,.]\d+)?)\s*[lL]\b(?!\w)/g, '$1 litres'],
        [/\b(\d+(?:[,.]\d+)?)\s*ml\b/gi, '$1 millilitres'],
        [/(\d+)\s*°C\b/g, '$1 degrés'],
        [/(\d+)\s*°F\b/g, '$1 degrés Fahrenheit'],
        [/\b(\d+(?:[,.]\d+)?)\s*W\b(?!\w)/g, '$1 watts'],
        [/\b(\d+(?:[,.]\d+)?)\s*kW\b/gi, '$1 kilowatts'],
        [/\b(\d+(?:[,.]\d+)?)\s*V\b(?!\w)/g, '$1 volts']
    ]
    for (const [re, rep] of units) {
        t = t.replace(re, rep as string)
    }
    return t
}

function normalizePercent(t: string): string {
    t = t.replace(/(\d+)[,.](\d+)\s*%/g, (_m, int, dec) => `${int} virgule ${dec} pourcent`)
    t = t.replace(/(\d+)\s*%/g, '$1 pourcent')
    return t
}

function normalizeReferences(t: string): string {
    t = t.replace(/[nN]°\s*(\d+)/g, 'numéro $1')
    t = t.replace(/§\s*(\d+)/g, 'paragraphe $1')
    t = t.replace(/\bp\.\s*(\d+)\b/g, 'page $1')
    return t
}

function normalizeDecimals(t: string): string {
    // French decimal comma: 3,14 → 3 virgule 14 (only between digits)
    t = t.replace(/\b(\d+),(\d+)\b/g, '$1 virgule $2')
    // English decimal point between digits (e.g. 1.5 but not end of sentence)
    t = t.replace(/\b(\d+)\.(\d+)\b/g, '$1 virgule $2')
    return t
}

function normalizeLargeNumbers(t: string): string {
    // Numbers with spaces as thousand separators: 1 000 000
    t = t.replace(/\b(\d{1,3}(?:\s\d{3})+)\b/g, (_m, raw) => {
        const n = parseInt(raw.replace(/\s/g, ''))
        return isNaN(n) ? raw : numberToFrench(n)
    })
    // Plain large numbers ≥ 1000 (no separators)
    t = t.replace(/\b(\d{4,})\b/g, (_m, raw) => {
        const n = parseInt(raw)
        return isNaN(n) ? raw : numberToFrench(n)
    })
    return t
}

function normalizeAbbreviations(t: string): string {
    const abbr: [RegExp, string][] = [
        [/\bM\.\s+(?=[A-ZÉÈÀÂÎÔÙÛÇÆŒ])/g, 'Monsieur '],
        [/\bMme\.?\s+/g, 'Madame '],
        [/\bDr\.?\s+/g, 'Docteur '],
        [/\bPr\.?\s+/g, 'Professeur '],
        [/\bProf\.?\s+/g, 'Professeur '],
        [/\betc\./gi, 'et cetera'],
        [/\bex\.\s/gi, 'par exemple '],
        [/\bc\.-à-d\./gi, "c'est-à-dire"],
        [/\bvs\.?\b/gi, 'versus'],
        [/\bcf\.\s/gi, 'voir '],
        [/\benv\.\s/gi, 'environ '],
        [/\bapprox\.\s/gi, 'approximativement '],
        [/\bmax\.\s/gi, 'maximum '],
        [/\bmin\.\s/gi, 'minimum '],
        [/\bqq\.\s/gi, 'quelques '],
        [/\bsvp\b/gi, "s'il vous plaît"],
        [/\bSVP\b/g, "s'il vous plaît"],
        [/\btsq\b/gi, 'tel que'],
        [/\bcad\b/gi, "c'est-à-dire"]
    ]
    for (const [re, rep] of abbr) {
        t = t.replace(re, rep)
    }
    return t
}

function normalizeSpecialChars(t: string): string {
    t = t.replace(/\s&\s/g, ' et ')
    t = t.replace(/\s\+\s/g, ' plus ')
    t = t.replace(/\s=\s/g, ' égal ')
    t = t.replace(/\s>\s/g, ' supérieur à ')
    t = t.replace(/\s<\s/g, ' inférieur à ')
    t = t.replace(/(\w)\/(\w)/g, '$1 ou $2')
    // @ outside of email context
    t = t.replace(/(?<!\S)@(?!\S)/g, ' arobase ')
    return t
}

function normalizeUrls(t: string): string {
    t = t.replace(/https?:\/\/\S+/g, 'lien web')
    t = t.replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '')
    return t
}

function normalizeAcronyms(t: string): string {
    return t.replace(/\b([A-ZÉÈÀÂÎÔÙÛÇÆŒ]{2,5})\b/g, (match) => {
        if (WORD_ACRONYMS.has(match)) return match
        return match.split('').join(' ')
    })
}

export function normalizeFrenchForTTS(text: string): string {
    let t = text
    t = normalizeTime(t)
    t = normalizeDates(t)
    t = normalizeCurrency(t)
    t = normalizeUnits(t)
    t = normalizePercent(t)
    t = normalizeReferences(t)
    t = normalizeDecimals(t)
    t = normalizeLargeNumbers(t)
    t = normalizeAbbreviations(t)
    t = normalizeSpecialChars(t)
    t = normalizeUrls(t)
    t = normalizeAcronyms(t)
    return t.trim()
}
