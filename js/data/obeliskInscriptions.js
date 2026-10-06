/**
 * What is written on the Obelisk of Theodosius, for the painted textures in
 * js/models/lib/obeliskArt.js.
 *
 * Each face of the shaft carries one column of hieroglyphs under a scene of
 * Thutmose III kneeling before Amun-Ra. The signs follow the king's standard
 * titulary; the narrative passages are paraphrased after Breasted, Ancient
 * Records of Egypt II (1906) and Habachi, The Obelisks of Egypt (1985), in the
 * reading published at obelisk-390.vercel.app. The signs are typeset in Noto
 * Sans Egyptian Hieroglyphs, so this is an illustration, not a facsimile.
 *
 * kinds: one letter per sign — w wide, n narrow, f flat. Two narrow or wide
 * signs in a row share a square side by side; runs of flat signs stack.
 * frame: 'cartouche' (a royal name) or 'serekh' (the Horus name, over a palace façade).
 */
export const OBELISK_FACES = [
  {
    name: 'I',
    subtitle: 'The Euphrates crossing',
    segments: [
      { glyphs: '𓅃', kinds: 'w', reading: 'Horus' },
      { frame: 'serekh', glyphs: '𓃒𓂡𓈍𓅓𓌀𓏏𓊖', kinds: 'wffwnfw', reading: 'Strong Bull, Appearing in Thebes' },
      { glyphs: '𓇓𓆤', kinds: 'nw', reading: 'King of Upper and Lower Egypt' },
      { frame: 'cartouche', glyphs: '𓇳𓏠𓆣', kinds: 'wfw', reading: 'Menkheperre' },
      { glyphs: '𓍑𓄿𓂻𓊪𓐍𓂋𓅨𓈖𓈖𓉔𓂋𓈖𓈉', kinds: 'nwwfffwffwfff', reading: 'who crossed the Great Bend of Naharin' },
      { glyphs: '𓅓𓈖𓆱𓐍𓏏𓂡𓅓𓄊𓋴𓂋𓂡𓁷𓄂𓏏𓀎𓏥𓆑', kinds: 'wfffffwnnffwwfwff', reading: 'in might and victory, at the head of his army' },
      { glyphs: '𓁹𓄡𓄿𓇋𓇋𓏏𓀐𓉻𓏏𓇋𓅓𓋴𓈖𓏥', kinds: 'fwwnnfwffnwnff', reading: 'making a great slaughter among them' },
    ],
  },
  {
    name: 'II',
    subtitle: 'The boundary at the Horn of the Earth',
    segments: [
      { glyphs: '𓅉𓌂𓄖𓏏𓂦𓈍𓏥', kinds: 'wnwfnff', reading: 'Golden Horus: Powerful of strength, sacred of appearances' },
      { glyphs: '𓇓𓆤', kinds: 'nw', reading: 'King of Upper and Lower Egypt' },
      { frame: 'cartouche', glyphs: '𓇳𓏠𓆣', kinds: 'wfw', reading: 'Menkheperre' },
      { glyphs: '𓅭𓇳', kinds: 'ww', reading: 'Son of Ra' },
      { frame: 'cartouche', glyphs: '𓅝𓄟𓋴𓄤𓆣𓏥', kinds: 'wnnwwf', reading: 'Thutmose, beautiful of forms' },
      { glyphs: '𓁹𓈖𓆑𓇾𓈙𓆑𓂋𓄋𓏏𓇾', kinds: 'ffffffffff', reading: 'who set his boundary at the Horn of the Earth' },
      { glyphs: '𓊪𓎛𓅱𓈖𓉔𓂋𓈖𓈉', kinds: 'fnwfwfff', reading: 'and at the marshes of Naharin' },
    ],
  },
  {
    name: 'III',
    subtitle: 'Dedication to Amun-Ra',
    segments: [
      { glyphs: '𓅃', kinds: 'w', reading: 'Horus' },
      { frame: 'serekh', glyphs: '𓃒𓂡𓈍𓅓𓌀𓏏𓊖', kinds: 'wffwnfw', reading: 'Strong Bull, Appearing in Thebes' },
      { glyphs: '𓅒𓎝𓇓𓏏𓏇𓇳𓅓𓇯', kinds: 'wwnfnwwf', reading: 'He of the Two Ladies: Enduring of kingship, like Ra in heaven' },
      { glyphs: '𓇓𓆤', kinds: 'nw', reading: 'King of Upper and Lower Egypt' },
      { frame: 'cartouche', glyphs: '𓇳𓏠𓆣', kinds: 'wfw', reading: 'Menkheperre' },
      { glyphs: '𓁹𓈖𓆑𓅓𓏠𓏌𓅱𓆑𓈖𓇋𓏏𓆑', kinds: 'fffwffwffnff', reading: 'He made it as his monument for his father' },
      { glyphs: '𓇋𓏠𓈖𓇳𓎟𓊨𓏥𓇾𓇾', kinds: 'nffwfnfff', reading: 'Amun-Ra, lord of the thrones of the Two Lands' },
      { glyphs: '𓋴𓂝𓊢𓂝𓈖𓆑𓏏𓐍𓈖𓉶𓏥𓅨𓂋𓅱𓏥', kinds: 'nfnffffffnfwfwf', reading: 'erecting for him great obelisks' },
    ],
  },
  {
    name: 'IV',
    subtitle: 'Lord of victories',
    segments: [
      { glyphs: '𓅉𓌂𓄖𓏏𓂦𓈍𓏥', kinds: 'wnwfnff', reading: 'Golden Horus: Powerful of strength, sacred of appearances' },
      { glyphs: '𓅭𓇳', kinds: 'ww', reading: 'Son of Ra' },
      { frame: 'cartouche', glyphs: '𓅝𓄟𓋴𓄤𓆣𓏥', kinds: 'wnnwwf', reading: 'Thutmose, beautiful of forms' },
      { glyphs: '𓌻𓂋𓇋𓏠𓈖𓇳𓎟𓊨𓏥𓇾𓇾', kinds: 'wfnffwfnfff', reading: 'beloved of Amun-Ra, lord of the thrones of the Two Lands' },
      { glyphs: '𓎟𓈖𓆱𓐍𓏏𓂡𓏥𓎁𓇾𓏥𓎟', kinds: 'fffffffwfff', reading: 'lord of victories, who seizes every land' },
      { glyphs: '𓏙𓋹𓏇𓇳𓆓𓏏𓇿', kinds: 'nnnwnff', reading: 'Given life, like Ra, forever' },
    ],
  },
];

/** The scene at the top of every face: the kneeling king, the sign for "god", the enthroned Amun-Ra, under the sky. */
export const OBELISK_SCENE = { sky: '𓇯', king: '𓀢', god: '𓊹', amun: '𓀭' };

/** East side of the lower pedestal block: five Latin hexameters, the obelisk speaking in the first person. */
export const LATIN_INSCRIPTION = [
  'DIFFICILIS QVONDAM DOMINIS PARERE SERENIS',
  'IVSSVS ET EXTINCTIS PALMAM PORTARE TYRANNIS',
  'OMNIA THEODOSIO CEDVNT SVBOLIQVE PERENNI',
  'TER DENIS SIC VICTVS EGO DOMITVSQVE DIEBVS',
  'IVDICE SVB PROCLO SVPERAS ELATVS AD AVRAS',
];

/**
 * On the marble base of the Walled Obelisk: six iambic trimeters of
 * Constantine VII Porphyrogennetos, cut in capitals without word breaks, as
 * on the stone. "This four-sided wonder of the heights, wasted by time, the
 * emperor Constantine, whose son Romanos is the glory of the sceptre, now
 * makes anew, finer than the old sight: the Colossus was a marvel in Rhodes,
 * and this bronze is a marvel here."
 */
export const WALLED_OBELISK_INSCRIPTION = [
  'ΤΟΤΕΤΡΑΠΛΕΥΡΟΝΘΑΥΜΑΤΩΝΜΕΤΑΡΣΙΩΝ',
  'ΧΡΟΝΩΦΘΑΡΕΝΝΥΝΚΩΝΣΤΑΝΤΙΝΟΣΔΕΣΠΟΤΗΣ',
  'ΟΥΡΩΜΑΝΟΣΠΑΙΣΔΟΞΑΤΗΣΣΚΗΠΤΟΥΧΙΑΣ',
  'ΚΡΕΙΤΤΟΝΝΕΟΥΡΓΕΙΤΗΣΠΑΛΑΙΘΕΩΡΙΑΣ',
  'ΟΓΑΡΚΟΛΟΣΣΟΣΘΑΜΒΟΣΗΝΕΝΤΗΡΟΔΩ',
  'ΚΑΙΧΑΛΚΟΣΟΥΤΟΣΘΑΜΒΟΣΕΣΤΙΝΕΝΘΑΔΕ',
];

/** West side of the lower pedestal block: two Greek elegiac couplets. They say thirty-two days; the Latin says thirty. */
export const GREEK_INSCRIPTION = [
  'ΚΙΟΝΑ ΤΕΤΡΑΠΛΕΥΡΟΝ ΑΕΙ ΧΘΟΝΙ ΚΕΙΜΕΝΟΝ ΑΧΘΟΣ',
  'ΜΟΥΝΟΣ ΑΝΑΣΤΗΣΑΙ ΘΕΥΔΟΣΙΟΣ ΒΑΣΙΛΕΥΣ',
  'ΤΟΛΜΗΣΑΣ ΠΡΟΚΛΟΣ ΕΠΕΚΕΚΛΕΤΟ ΚΑΙ ΤΟΣΟΣ ΕΣΤΗ',
  'ΚΙΩΝ ΗΕΛΙΟΙΣ ΕΝ ΤΡΙΑΚΟΝΤΑ ΔΥΩ',
];
