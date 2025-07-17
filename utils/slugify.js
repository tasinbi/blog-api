const slugify = (text) => {
  // Support for Bangla and English slugs
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-') // Replace spaces and non-word chars with -
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Alternative slugify for Bangla (transliteration)
const slugifyBangla = (text) => {
  // Common Bangla to English transliteration map
  const banglaToEnglish = {
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u',
    'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'ch', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh',
    'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y',
    'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u',
    'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    '্': '', '০': '0', '১': '1', '২': '2', '৩': '3',
    '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };

  let transliterated = text;
  for (const [bangla, english] of Object.entries(banglaToEnglish)) {
    const regex = new RegExp(bangla, 'g');
    transliterated = transliterated.replace(regex, english);
  }

  return transliterated
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Smart slugify - detects if text contains Bangla
const smartSlugify = (text, forceTransliterate = false) => {
  const hasBangla = /[\u0980-\u09FF]/.test(text);
  
  if (hasBangla && forceTransliterate) {
    return slugifyBangla(text);
  }
  
  return slugify(text);
};

module.exports = {
  slugify,
  slugifyBangla,
  smartSlugify
};