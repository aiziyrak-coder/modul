const LANG_KEYS = new Set(['eng', 'en', 'uz', 'ru']);

const isTranslationObject = (obj) => {
    const keys = Object.keys(obj);
    return keys.length >= 2 && keys.every(k => LANG_KEYS.has(k));
};

const translaterLanguage = (data, lang) => {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(i => translaterLanguage(i, lang));

    if (data instanceof Date) return data;
    if (data instanceof RegExp) return data;
    if (data instanceof Buffer) return data;
    if (data.constructor?.name === 'ObjectId') return data;

    if (isTranslationObject(data)) {
        const keys = Object.keys(data);
        return data[lang] ?? "";
    }

    const result = {};
    for (const key of Object.keys(data)) {
        result[key] = translaterLanguage(data[key], lang);
    }
    return result;
};

module.exports = {
    translaterLanguage
}