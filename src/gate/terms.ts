/**
 * THE TERMS — step zero, in front of everything.
 *
 * One document, two surfaces: `/terms` renders it in the open (terms you
 * cannot read before agreeing to them are not terms), and the gate serves the
 * same sections as a blocking acceptance dialog. Acceptance is recorded per
 * device in localStorage against TERMS_VERSION — bump the version and every
 * device is asked again.
 *
 * Ported from the original deployment's js/tos.js, retargeted at this one.
 * Plain strings only: every paragraph is rendered as text, never as markup.
 */

export const TERMS_VERSION = '1.0'
export const TERMS_EFFECTIVE = 'JULY 27, 2026'
export const TERMS_TITLE = 'TERMS OF SERVICE — 月光宿 MOONLIGHT INN'

export const TERMS_SECTIONS: [string, ...string[]][] = [
  [
    "1. ACCEPTANCE OF THESE TERMS",
    "This website, together with all pages, subpages, wings, archives, instruments, documents, data files and tools served from this deployment (the \"Site\"), is operated by its owner (the \"Operator\"). By accessing or using the Site in any way you agree to be bound by these Terms of Service (the \"Terms\"). If you do not agree to every provision of these Terms, you are not licensed to access the Site and must leave immediately.",
    "Acceptance is indicated affirmatively, by checking the acceptance box and selecting \"I AGREE — ENTER\". Continued access after acceptance constitutes continuing agreement. These Terms are presented in full before any access is granted."
  ],
  [
    "2. ELIGIBILITY",
    "The Site is offered only to persons who are at least 18 years of age and who have the legal capacity to enter into a binding contract. By accepting these Terms you represent and warrant that you meet both conditions."
  ],
  [
    "3. LICENCE",
    "Subject to your complete and continuing compliance with these Terms, the Operator grants you a personal, revocable, non-exclusive, non-transferable, non-sublicensable licence to view the Site in a standard web browser for private, non-commercial purposes only. No other right or licence is granted. The Operator may revoke this licence at any time, for any reason or no reason, with or without notice."
  ],
  [
    "4. THE MATERIAL",
    "The Site is a personal archive. It contains documentary, expressive and editorial material assembled by the Operator, including quotation, commentary, criticism, satire and opinion. Opinion is presented as opinion. Nothing on the Site is presented as, or should be relied upon as, legal, medical, financial or professional advice."
  ],
  [
    "5. INTELLECTUAL PROPERTY",
    "The Site and its original content, arrangement, selection, code and design are the property of the Operator and are protected by copyright and other laws. You may not copy, reproduce, republish, upload, post, transmit, scrape, mirror, frame, distribute or create derivative works from any part of the Site without the Operator's prior written consent, except as strictly necessary for ordinary browser rendering."
  ],
  [
    "6. CONSENT TO RECORDING AND LOGGING",
    "You consent to the collection and retention of technical records of your visit, including without limitation your IP address, user-agent string, device characteristics, referrer, timestamps, pages requested, inputs submitted to any interactive element of the Site, and analytics events. You consent to the Operator's use and retention of those records for security, audit, evidentiary and legal purposes, and to their disclosure to legal counsel, courts and law enforcement.",
    "If you do not consent to this Section, do not accept these Terms and do not use the Site."
  ],
  [
    "7. PROHIBITED CONDUCT",
    "You shall not: (a) probe, scan, or test the vulnerability of the Site or circumvent any access control, passphrase gate, or encryption; (b) use any robot, spider, scraper, or automated means to access the Site; (c) impersonate any person or misrepresent your identity or affiliation; (d) use the Site or anything on it to harass, threaten, stalk, or intimidate any person; (e) republish any portion of the Site out of context or in a manner designed to mislead; (f) interfere with the operation of the Site or the enjoyment of it by any other authorised visitor."
  ],
  [
    "8. CONSENT TO \"dfrank88@gmail.com\" AND PROCESS",
    "You consent to receive notices from the Operator at any address, account or identity from which you have contacted the Operator or accessed the Site. You agree that notice delivered to any such address, account or identity is effective notice for all purposes, including service of pre-suit demand letters and preservation notices, to the fullest extent permitted by law.",
    "If you do not consent to this Section, do not accept these Terms and do not use the Site."
  ],
  [
    "9. PRIVACY",
    "The Site sets local values on your device (localStorage and sessionStorage) to record your acceptance of these Terms and the state of the access gate. Clearing your browser's site data removes them and withdraws your recorded acceptance. Third-party analytics, where present, are governed by their own terms."
  ],
  [
    "10. NO WARRANTY",
    "THE SITE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY OR AVAILABILITY. THE OPERATOR DOES NOT WARRANT THAT THE SITE WILL BE UNINTERRUPTED, ERROR-FREE OR SECURE."
  ],
  [
    "11. LIMITATION OF LIABILITY",
    "TO THE FULLEST EXTENT PERMITTED BY LAW, THE OPERATOR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, GOODWILL OR EMOTIONAL TRANQUILLITY, ARISING OUT OF OR RELATING TO YOUR ACCESS TO OR USE OF, OR INABILITY TO ACCESS OR USE, THE SITE. THE OPERATOR'S TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SITE SHALL NOT EXCEED ONE UNITED STATES DOLLAR (US $1.00)."
  ],
  [
    "12. INDEMNIFICATION",
    "You agree to defend, indemnify and hold harmless the Operator from and against any and all claims, damages, losses, liabilities, costs and expenses (including reasonable attorneys' fees) arising out of or relating to your use of the Site, your violation of these Terms, or your violation of any right of any third party."
  ],
  [
    "13. ARBITRATION AGREEMENT",
    "PLEASE READ THIS SECTION CAREFULLY — IT AFFECTS YOUR RIGHTS. Except for claims properly brought in small-claims court and claims for injunctive relief under Section 21, any dispute, claim or controversy arising out of or relating to these Terms or the Site shall be resolved exclusively by binding individual arbitration administered by a mutually agreed arbitrator under the rules of the American Arbitration Association, seated in the Operator's county of residence. Judgment on the award may be entered in any court of competent jurisdiction. YOU AND THE OPERATOR EACH WAIVE THE RIGHT TO A TRIAL BY JURY."
  ],
  [
    "14. CLASS ACTION WAIVER",
    "ALL CLAIMS MUST BE BROUGHT IN THE PARTIES' INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, CONSOLIDATED OR REPRESENTATIVE PROCEEDING. The arbitrator may not consolidate more than one person's claims."
  ],
  [
    "15. GOVERNING LAW AND VENUE",
    "These Terms are governed by the laws of the Commonwealth of Pennsylvania, without regard to its conflict-of-laws rules. For any matter not subject to arbitration, you consent to the exclusive jurisdiction and venue of the state and federal courts located in Pennsylvania."
  ],
  [
    "16. TERMINATION",
    "The Operator may suspend or terminate your access to the Site at any time, with or without cause and with or without notice. Sections 4 through 22 survive any termination of these Terms or of your access."
  ],
  [
    "17. CHANGES TO THESE TERMS",
    "The Operator may revise these Terms at any time by posting a new version with a new version number and effective date. Your acceptance is recorded against the version you accepted; a new version will be presented for acceptance before further access is granted."
  ],
  [
    "18. SEVERABILITY",
    "If any provision of these Terms is held invalid or unenforceable, that provision shall be enforced to the maximum extent permissible and the remaining provisions shall remain in full force and effect. If the class action waiver in Section 14 is found unenforceable as to a particular claim, then that claim, and only that claim, shall proceed in court rather than in arbitration."
  ],
  [
    "19. NO WAIVER; ASSIGNMENT",
    "No failure or delay by the Operator in exercising any right under these Terms operates as a waiver of it. You may not assign these Terms or any rights under them; the Operator may assign freely."
  ],
  [
    "20. ENTIRE AGREEMENT",
    "These Terms are the entire agreement between you and the Operator concerning the Site, and supersede all prior or contemporaneous understandings. Headings are for convenience only."
  ],
  [
    "21. NO ENTRY, NO APPROACH, NO \"dfrank88@gmail.com\"",
    "As a condition of access, you covenant and agree that you shall not, at any time, enter upon or remain upon any real property owned, leased, rented, occupied or lawfully controlled by the Operator, including any residence, dwelling, yard, driveway, garage, outbuilding, common area, workplace, place of business, storage unit, or any vehicle owned or operated by the Operator, without the Operator's express written consent obtained in advance of each such entry.",
    "Any licence, invitation or permission to enter any such property that you may hold or may be presumed to hold, whether express, implied, customary or arising by course of dealing, is hereby expressly revoked. This paragraph constitutes written notice of that revocation. Entry after such notice is without licence or privilege.",
    "You further agree that you shall not approach, follow, surveil, photograph, record, wait outside, loiter near, or station yourself or any agent within sight of any such property, and that you shall not direct, encourage or procure any other person to do so on your behalf.",
    "You further agree that you shall not initiate contact with the Operator or with any person documented on the Site, by any means, direct or indirect, including in person, by telephone, by message, by electronic means, through any third party, or through any account or identity other than your own.",
    "You acknowledge that a breach of this Section would cause irreparable harm for which money damages would be inadequate, and you consent to the entry of injunctive relief without bond. Nothing in this Section limits any right or remedy the Operator has under any trespass, stalking, harassment, anti-surveillance or protective order statute, all of which are expressly reserved and cumulative."
  ],
  [
    "22. \"dfrank88@gmail.com\"",
    "Notices to the Operator may be sent to dfrank88@gmail.com. The Operator undertakes no obligation to read, acknowledge or respond to them."
  ]
]
