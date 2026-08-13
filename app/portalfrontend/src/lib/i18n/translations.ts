/**
 * English/Filipino dictionaries for the portal's public marketing and trust pages.
 *
 * ── SCOPE (deliberately limited) ─────────────────────────────────────────────────────────────
 * Translated: the landing page, site footer, and the standalone public pages a visitor can reach
 * without logging in (Requirements, Security & Anti-Scam, Complaints, Contact, News chrome,
 * Not Found).
 *
 * NOT translated, on purpose:
 *   - Privacy Policy / Terms and Conditions: this is legally-binding consent text sourced from
 *     RA 9510/RA 10173 boilerplate carried over from the legacy site. Machine-translating binding
 *     legal language without professional/legal review is a real liability, not a nice-to-have -
 *     it stays English-only until legal signs off on a reviewed Filipino version.
 *   - The loan application form, auth pages (login/signup/etc.), and the authenticated app
 *     (Dashboard/Profile/Loan Products): large surface area, and a partially-translated banking
 *     flow reads as broken rather than bilingual. Scoped out as follow-up work rather than done
 *     half-way - see docs/PORTAL_WEBSITE_STRATEGY.md.
 *   - Loan product names/details (`loanProducts.ts`) and document/eligibility terms
 *     (`loanRequirements.ts`): shared with the (untranslated) application form, and product/
 *     document names are conventionally kept in English/official terminology even on Filipino bank
 *     pages in the Philippines (e.g. "Valid ID", "Proof of Billing").
 *   - OfflineBanner / ErrorBoundary: these render globally, including over the untranslated
 *     authenticated app and legal pages. Translating them would let the offline/error message flip
 *     to Filipino on an otherwise all-English screen, which reads as a bug, not bilingual support -
 *     so this shared chrome stays English-only regardless of the selected language.
 *
 * ── WHY A TYPED OBJECT, NOT i18next-STYLE STRING KEYS ────────────────────────────────────────
 * `t('landing.hero.title')` has no compile-time link between the key string and its usage - a typo
 * or a missing translation fails silently at runtime. Here, `fil` is assigned the exact type of
 * `en` (via `satisfies`), so TypeScript refuses to compile if a translation is missing, misspelled,
 * or has the wrong shape. This mirrors the project's existing preference for typed structures over
 * magic strings (see NewsBlock's discriminated union in content/news.ts).
 */

export const en = {
  common: {
    backToHome: 'Back to home',
    applyNow: 'Apply Now',
    logIn: 'Log In',
    createAccount: 'Create Your Account',
  },
  nav: {
    requirements: 'Requirements',
    news: 'News',
    security: 'Security',
    goToDashboard: 'Go to Dashboard',
    requirementsFull: 'Loan Requirements',
    newsFull: 'News & Announcements',
    securityFull: 'Security & Anti-Scam',
    theme: 'Theme',
    language: 'Language',
  },
  footer: {
    tagline:
      'Easycash is a lending company registered with the Securities and Exchange Commission of the Philippines. Loan approval and final terms are subject to credit evaluation.',
    contactHeading: 'Contact',
    contactPageLink: 'Contact page',
    viewOnMap: 'View on map',
    quickLinksHeading: 'Quick Links',
    requirements: 'Loan Requirements',
    news: 'News & Announcements',
    security: 'Security & Anti-Scam',
    complaints: 'File a Complaint',
    privacy: 'Data Privacy Statement',
    terms: 'Terms and Conditions',
    rightsReserved: 'All rights reserved.',
    scamWarning: 'Easycash will never ask for a fee before releasing your loan, or for your OTP or password.',
  },
  landing: {
    badge: 'Easycash Lending Company Inc.',
    heroTitle: "We're here to empower your financial voyage",
    heroSubtitle:
      'Apply for a loan online in minutes, track your application status in real time, and manage your account - all from one place.',
    applyToday: 'Apply for a Loan Today',
    statYearsLabel: 'Years in Business',
    statDreamsLabel: 'Dreams Reached',
    statPartnersLabel: 'Corporate Partners',
    trustSecRegistered: 'SEC Registered Lending Company',
    trustNoAdvanceFee: 'Never asks for a fee before releasing your loan',
    trustDataProtected: 'Your data is protected',
    missionTitle: 'Dream Big, Fear Less',
    missionBody:
      "We understand the fears - debt traps, loan rejections, and financial uncertainties. Your dreams are worth pursuing, and we're here to minimize your fears. Our commitment is to provide not just fast loans but pathways to a brighter future. Your dreams, your financial security - it's what we live for.",
    productsTitle: 'A loan for every dream',
    productsSubtitle: "Whatever you're working toward, there's an Easycash product built for it.",
    applyForThisLoan: 'Apply for this loan',
    seeRequirements: 'See requirements',
    howItWorksTitle: 'No nonsense. Just a better borrowing experience.',
    steps: [
      { title: 'Create an account', body: 'Sign up with your email in under a minute.' },
      { title: 'Apply online', body: 'Fill out one simple form and submit your requirements.' },
      { title: 'Track your status', body: 'See exactly where your application stands, anytime.' },
    ],
    features: [
      { title: 'Easy & convenient', body: 'Apply anytime, anywhere, from your phone or desktop.' },
      { title: 'Flexible terms', body: 'Payment schedules that work with how you actually get paid.' },
      { title: 'Safe & secure', body: 'Your information is protected - we take confidentiality seriously.' },
    ],
    waysToPayTitle: 'Ways to pay',
    waysToPaySubtitle: 'Settle your installments through either of these channels.',
    waysToPay: [
      { title: 'Bank Transfer', body: 'Pay directly from your bank account.' },
      { title: 'Post-Dated Check (PDC)', body: 'Set up post-dated checks matched to your payment schedule.' },
    ],
    officialBankAccountHeading: 'Payment to Official Bank Account',
    officialBankAccountProofNote: 'Please send proof of payment to',
    testimonialsTitle: 'People say the nicest things',
    testimonialsSubtitle:
      "Here's the compelling reason why thousands of businesses and individuals have opted for our expertise to drive their financial growth.",
    testimonialsNote: 'Client stories shown in English as originally given.',
    faqTitle: 'Frequently asked questions',
    faqs: [
      {
        question: 'What is Easycash?',
        answer: 'Easycash is a financial service that provides fast and convenient cash solutions to qualified applicants in the Philippines.',
      },
      {
        question: 'Is Easycash a registered company?',
        answer: 'Yes. Easycash operates in compliance with applicable Philippine laws and regulations.',
      },
      {
        question: 'Who can apply for Easycash services?',
        answer: 'Eligible applicants are Filipino citizens who meet the minimum age, income, and identification requirements.',
      },
      {
        question: 'Who is eligible to apply for a loan?',
        answer: 'Applicants must be at least 18 years old, be a Filipino citizen or resident, have a valid government-issued ID, and have a stable source of income.',
      },
      {
        question: 'Do I need collateral to apply?',
        answer: 'No. Easycash loans are unsecured and do not require collateral.',
      },
      {
        question: 'I already have a loan with Easycash - can I apply again?',
        answer:
          "Yes. Once your current loan is fully settled and closed, you can submit a new (renewal) application right from your Easycash Portal account - no need to start over as a new applicant.",
      },
    ],
    ctaTitle: 'Ready to get started?',
    ctaBody: 'Create your free Easycash account and apply for a loan in minutes.',
  },
  eligibilityCheck: {
    title: 'Not sure if you qualify?',
    subtitle: 'Answer 4 quick questions - takes 30 seconds, no account needed.',
    /** Mirrors ELIGIBILITY_CRITERIA in loanRequirements.ts index-for-index (question phrasing of
     * the same 4 facts) - never add a 5th question here without adding the matching criterion
     * there first, and vice versa. */
    questions: [
      'Are you at least 18 years old?',
      'Are you a Filipino citizen or resident of the Philippines?',
      'Do you have a valid government-issued ID?',
      'Do you have a stable source of income?',
    ],
    yes: 'Yes',
    no: 'No',
    checkButton: 'Check Eligibility',
    disclaimer: 'This is a quick self-check, not a loan approval - every application still goes through Easycash\'s full review process.',
    resultPassTitle: 'You meet Easycash\'s basic eligibility requirements!',
    resultPassBody: 'You can go ahead and apply. Have your requirements ready to make it even faster.',
    resultFailTitle: 'You may not meet the minimum requirements yet',
    resultFailBody: 'Based on your answers, Easycash may not be able to approve an application right now. If you think this doesn\'t reflect your situation, feel free to contact us.',
    startOver: 'Start over',
  },
  loanCalculator: {
    title: 'How much could your payments be?',
    subtitle: 'Move the sliders to get an instant estimate - no account needed.',
    loanType: 'Loan type',
    amountLabel: 'Loan amount',
    termLabel: 'Term (months)',
    monthlyPayment: 'Estimated monthly payment',
    totalRepayment: 'Total repayment',
    disclaimer:
      'Sample computation only, not a loan offer. This uses a flat 3%/month rate as a rough approximation - actual interest rates vary by loan product and term, and your final rate and approved amount depend on Easycash\'s full credit evaluation.',
  },
  requirements: {
    title: 'Loan Requirements',
    intro: 'What you need to prepare before you apply. Getting these ready first makes the application much faster.',
    whoCanApply: 'Who can apply',
    eligibilityNote: 'Meeting these does not by itself guarantee approval - every application goes through credit evaluation.',
    documentsHeading: 'Documents by loan type',
    documentsIntro: 'You can submit your application first and upload these afterwards, but having them ready speeds things up considerably.',
    coBorrowerNote: 'If you are applying with a co-borrower, they will also need to provide a valid ID.',
    readyHeading: 'Ready to apply?',
    readyBody: 'Create an account and submit your application online - you can save your progress and come back to it.',
  },
  securityTips: {
    title: 'Security & Anti-Scam',
    intro: 'Scammers impersonate legitimate lending companies, including Easycash. This page tells you exactly what we will never do, so you can recognise a fake immediately.',
    alertTitle: 'If someone asks you to pay a fee before your loan is released, it is a scam.',
    alertBody: 'This is the most common scam used against borrowers in the Philippines. Stop, do not send money, and report it to us using the channels below.',
    neverDoesHeading: 'What Easycash will never do',
    neverDoes: [
      {
        title: 'Ask for a fee before releasing your loan',
        body: 'Easycash never requires an advance payment, "processing fee", "insurance fee", or "release fee" sent to a personal GCash, Maya, or bank account before your loan proceeds are released. Any deductible fees are disclosed in your loan documents and taken from the proceeds - never collected separately in advance.',
      },
      {
        title: 'Ask for your OTP, password, or PIN',
        body: 'No Easycash employee will ever ask for your one-time PIN, your portal password, your card PIN, or your online banking credentials - not by call, text, email, or chat. An OTP is for you alone to enter.',
      },
      {
        title: 'Ask you to pay through a personal account',
        body: "Payments are only accepted through official Easycash channels under the company name. Never send money to an individual person's account, even if they claim to be an Easycash agent or collector.",
      },
      {
        title: 'Access your phone contacts or photo gallery',
        body: 'Easycash does not harvest your contact list or your photos, and does not contact your family, friends, or employer to shame you over a debt. Any lender doing this is violating the Data Privacy Act of 2012 and SEC rules on unfair debt collection.',
      },
      {
        title: 'Threaten, harass, or publicly shame you',
        body: 'Collection is conducted lawfully and respectfully. Threats of arrest, public exposure, or messages to your contacts are not Easycash practices - report them to us immediately.',
      },
    ],
    channelsHeading: 'Our official channels',
    channelsIntro: 'These are the only channels Easycash uses. If a message comes from anywhere else, treat it as suspicious.',
    channelLandline: 'Landline',
    channelSmart: 'Smart',
    channelGlobe: 'Globe',
    channelDpo: 'Data Privacy Officer',
    registeredOffice: 'Registered office',
    protectHeading: 'How to protect yourself',
    protect: [
      'Verify the sender. Compare any number or email against our official channels listed above before you reply.',
      'Check our registration. Easycash is registered with the SEC - you can verify our company name and registration on the SEC\'s official website.',
      'Never share an OTP. Treat it like cash: once it is out, it is gone.',
      'Use a strong, unique password for your Easycash Portal account, and never reuse it on other sites.',
      'Log in only through this portal. Do not enter your credentials into a link sent by text or chat - open the site yourself.',
      'Keep your contact details current so we can reach you through the right channel.',
      'Read before you sign. Your disclosure statement shows the full cost of your loan.',
    ],
    targetedHeading: 'Think you have been targeted?',
    targetedBody: 'Report it to us right away so we can warn other borrowers - even if you did not lose money. Contact us through any official channel above, or {complaintsLink}.',
    targetedLinkText: 'file a formal complaint',
  },
  complaints: {
    title: 'File a Complaint',
    intro: 'If something went wrong, we want to hear about it directly. Easycash takes every complaint seriously, and raising one will never affect how your loan is handled.',
    reachUsHeading: 'How to reach us',
    byPhone: 'By phone',
    inWriting: 'In writing',
    inWritingNote: 'For data privacy matters and formal written concerns.',
    mailTo: 'Or by mail to:',
    includeHeading: 'What to include',
    includeIntro: 'The more complete your complaint, the faster we can investigate it.',
    include: [
      'Your full name and the mobile number or email registered with your Easycash account',
      'Your loan or application reference number, if you have one',
      'A clear description of what happened, including dates',
      'The names or numbers of anyone you dealt with, if relevant',
      'Any screenshots, receipts, or documents that support your complaint',
      'What outcome you are asking for',
    ],
    privacyHeading: 'Data privacy concerns',
    privacyBody: 'If your concern is about how your personal information was collected, used, or shared, address it to our Data Protection Officer at {dpoEmail}. Your rights as a data subject are described in our {privacyLink}. You may also raise the matter with the National Privacy Commission.',
    privacyLinkText: 'Data Privacy Statement',
    unresolvedHeading: 'If we cannot resolve it',
    unresolvedBody: 'Easycash operates under a Certificate of Authority from the Securities and Exchange Commission. If your complaint remains unresolved after raising it with us, you may escalate it to the SEC, which supervises lending companies in the Philippines and maintains its own consumer assistance channel.',
    scamHeading: 'Reporting a scam',
    scamBody: 'If someone impersonating Easycash asked you for an advance fee, an OTP, or a payment to a personal account, report it through any channel above and read our {securityLink} to confirm which channels are genuinely ours.',
    scamLinkText: 'Security & Anti-Scam guide',
  },
  contact: {
    title: 'Contact Us',
    intro: 'Reach Easycash through any of the channels below. These are our only official contact details.',
    phoneHeading: 'Phone',
    emailHeading: 'Email',
    emailNote: 'For data privacy matters and formal written concerns.',
    officeHeading: 'Registered office',
    hoursHeading: 'Business hours',
    impostorsHeading: 'Beware of impostors',
    impostorsBody: 'If someone contacts you from a number or account not listed on this page claiming to be Easycash, treat it as a scam. Read our {securityLink}.',
    impostorsLinkText: 'Security & Anti-Scam guide',
    complaintHeading: 'Have a complaint?',
    complaintBody: 'We would rather hear about it directly. {complaintsLink} and we will look into it.',
    complaintLinkText: 'File a complaint',
  },
  news: {
    title: 'News & Announcements',
    intro: 'Service advisories, financial guides, and company updates from Easycash.',
    emptyTitle: 'No posts yet',
    emptyBody: 'Easycash announcements, service advisories, and financial guides will appear here. Check back soon.',
    filterAll: 'All',
    backToAllNews: 'Back to all news',
    notFoundTitle: 'Post not found',
    notFoundIntro: 'This post may have been moved or removed.',
  },
  notFound: {
    title: 'Page not found',
    intro: 'The page you are looking for does not exist, or it may have been moved.',
    whereHeading: 'Where would you like to go?',
    linkHome: 'Home',
    linkRequirements: 'Loan Requirements',
    linkNews: 'News & Announcements',
    linkSecurity: 'Security & Anti-Scam',
    linkContact: 'Contact Us',
    backToHome: 'Back to home',
  },
};

/** The canonical shape every locale must satisfy - derived from `en` above so a missing or
 * mistyped key in `fil` fails the build, not silently at runtime. */
export type Translations = typeof en;

export const fil: Translations = {
  common: {
    backToHome: 'Bumalik sa Home',
    applyNow: 'Mag-apply Ngayon',
    logIn: 'Mag-log In',
    createAccount: 'Gumawa ng Account',
  },
  nav: {
    requirements: 'Requirements',
    news: 'Balita',
    security: 'Seguridad',
    goToDashboard: 'Pumunta sa Dashboard',
    requirementsFull: 'Mga Kailangan sa Pag-apply',
    newsFull: 'Balita at mga Anunsyo',
    securityFull: 'Seguridad at Anti-Scam',
    theme: 'Tema',
    language: 'Wika',
  },
  footer: {
    tagline:
      'Ang Easycash ay isang lending company na rehistrado sa Securities and Exchange Commission ng Pilipinas. Ang pag-apruba ng loan at pangwakas na mga termino ay sasailalim sa credit evaluation.',
    contactHeading: 'Contact',
    contactPageLink: 'Contact page',
    viewOnMap: 'Tingnan sa mapa',
    quickLinksHeading: 'Mga Mabilisang Link',
    requirements: 'Mga Kailangan sa Pag-apply',
    news: 'Balita at mga Anunsyo',
    security: 'Seguridad at Anti-Scam',
    complaints: 'Magsampa ng Reklamo',
    privacy: 'Pahayag ng Data Privacy',
    terms: 'Mga Tuntunin at Kundisyon',
    rightsReserved: 'Nakalaan ang lahat ng karapatan.',
    scamWarning: 'Hindi kailanman hihingi ang Easycash ng bayad bago ilabas ang loan, o ng iyong OTP o password.',
  },
  landing: {
    badge: 'Easycash Lending Company Inc.',
    heroTitle: 'Narito kami para gabayan ang iyong paglalakbay patungo sa magandang kinabukasan',
    heroSubtitle:
      'Mag-apply ng loan online sa loob lamang ng ilang minuto, subaybayan ang status ng iyong aplikasyon anumang oras, at pamahalaan ang iyong account - lahat sa isang lugar lamang.',
    applyToday: 'Mag-apply ng Loan Ngayon',
    statYearsLabel: 'Taon sa Negosyo',
    statDreamsLabel: 'Natulungang mga Pangarap',
    statPartnersLabel: 'Corporate Partners',
    trustSecRegistered: 'Rehistradong Lending Company sa SEC',
    trustNoAdvanceFee: 'Hindi kailanman humihingi ng bayad bago ilabas ang loan',
    trustDataProtected: 'Protektado ang iyong datos',
    missionTitle: 'Mangarap nang Malaki, Bawasan ang Takot',
    missionBody:
      'Naiintindihan namin ang mga takot - ang bitag ng utang, pagtanggi sa loan, at kawalan ng katiyakan sa pananalapi. Karapat-dapat na tugisin ang iyong mga pangarap, at narito kami para bawasan ang iyong mga takot. Ang aming pangako ay magbigay hindi lamang ng mabilis na loan kundi ng daan tungo sa mas maliwanag na kinabukasan. Ang iyong mga pangarap, ang iyong seguridad sa pananalapi - ito ang dahilan kung bakit kami nandito.',
    productsTitle: 'May loan para sa bawat pangarap',
    productsSubtitle: 'Anuman ang iyong pinagsusumikapan, may produkto ang Easycash na iginawa para dito.',
    applyForThisLoan: 'Mag-apply ng loan na ito',
    seeRequirements: 'Tingnan ang mga kailangan',
    howItWorksTitle: 'Walang kalabisan. Mas mahusay na karanasan sa paghiram.',
    steps: [
      { title: 'Gumawa ng account', body: 'Mag-sign up gamit ang iyong email sa loob ng isang minuto.' },
      { title: 'Mag-apply online', body: 'Punan ang isang simpleng form at isumite ang iyong mga kailangan.' },
      { title: 'Subaybayan ang status', body: 'Malaman kung nasaan na ang iyong aplikasyon, anumang oras.' },
    ],
    features: [
      { title: 'Madali at maginhawa', body: 'Mag-apply anumang oras, kahit saan, gamit ang iyong telepono o computer.' },
      { title: 'Flexible na mga termino', body: 'Mga iskedyul ng bayad na akma sa paraan ng iyong pagkita.' },
      { title: 'Ligtas at secure', body: 'Ang iyong impormasyon ay protektado - seryoso kami sa pagiging kumpidensyal.' },
    ],
    waysToPayTitle: 'Mga paraan ng pagbabayad',
    waysToPaySubtitle: 'Bayaran ang iyong mga hulog gamit ang alinman sa mga channel na ito.',
    waysToPay: [
      { title: 'Bank Transfer', body: 'Magbayad direkta mula sa iyong bank account.' },
      { title: 'Post-Dated Check (PDC)', body: 'Mag-set up ng post-dated checks na naka-tugma sa iskedyul ng iyong bayad.' },
    ],
    officialBankAccountHeading: 'Bayad sa Opisyal na Bank Account',
    officialBankAccountProofNote: 'Ipadala ang proof of payment sa',
    testimonialsTitle: 'Ang sinasabi ng aming mga kliyente',
    testimonialsSubtitle:
      'Ito ang dahilan kung bakit libo-libong negosyo at indibidwal ang pumili sa aming serbisyo para sa kanilang paglago sa pananalapi.',
    testimonialsNote: 'Ipinapakita sa Ingles ang mga kwento ng kliyente, ayon sa orihinal na sinabi nila.',
    faqTitle: 'Mga Madalas Itanong',
    faqs: [
      {
        question: 'Ano ang Easycash?',
        answer: 'Ang Easycash ay isang serbisyong pinansyal na nagbibigay ng mabilis at maginhawang solusyon sa cash para sa mga kwalipikadong aplikante sa Pilipinas.',
      },
      {
        question: 'Rehistradong kompanya ba ang Easycash?',
        answer: 'Oo. Ang Easycash ay umaandar alinsunod sa mga naaangkop na batas at regulasyon ng Pilipinas.',
      },
      {
        question: 'Sino ang puwedeng mag-apply sa mga serbisyo ng Easycash?',
        answer: 'Ang mga kwalipikadong aplikante ay mga mamamayang Pilipino na nakakatugon sa minimum na edad, kita, at mga kinakailangang identification.',
      },
      {
        question: 'Sino ang karapat-dapat mag-apply ng loan?',
        answer: 'Dapat ay hindi bababa sa 18 taong gulang ang aplikante, mamamayan o residente ng Pilipinas, may wastong government-issued ID, at may matatag na kinikita.',
      },
      {
        question: 'Meron na akong loan sa Easycash - puwede pa ba akong mag-apply ulit?',
        answer:
          'Oo. Kapag nabayaran na nang buo at nasarahan na ang iyong kasalukuyang loan, puwede ka nang mag-submit ng bagong (renewal) application diretso sa iyong Easycash Portal account - hindi mo na kailangang magsimula bilang bagong aplikante.',
      },
      {
        question: 'Kailangan ba ng collateral para mag-apply?',
        answer: 'Hindi. Ang mga loan ng Easycash ay unsecured at hindi nangangailangan ng collateral.',
      },
    ],
    ctaTitle: 'Handa ka na bang magsimula?',
    ctaBody: 'Gumawa ng libreng Easycash account at mag-apply ng loan sa loob ng ilang minuto.',
  },
  eligibilityCheck: {
    title: 'Hindi sigurado kung kwalipikado ka?',
    subtitle: 'Sagutin ang 4 na mabilisang tanong - 30 segundo lang, walang kailangang account.',
    questions: [
      'Ikaw ba ay 18 taong gulang pataas?',
      'Ikaw ba ay mamamayan o residente ng Pilipinas?',
      'May wasto ka bang government-issued ID?',
      'May matatag ka bang pinagkukunan ng kita?',
    ],
    yes: 'Oo',
    no: 'Hindi',
    checkButton: 'Suriin ang Kwalipikasyon',
    disclaimer: 'Mabilisang self-check lamang ito, hindi ito pag-apruba ng loan - dumadaan pa rin ang bawat aplikasyon sa buong proseso ng pagsusuri ng Easycash.',
    resultPassTitle: 'Nakakatugon ka sa mga pangunahing kinakailangan ng Easycash!',
    resultPassBody: 'Puwede ka nang mag-apply. Ihanda ang iyong mga kailangan para mas mabilis pa.',
    resultFailTitle: 'Maaaring hindi mo pa natutugunan ang minimum na kinakailangan',
    resultFailBody: 'Batay sa iyong mga sagot, maaaring hindi ma-apruba ng Easycash ang aplikasyon sa ngayon. Kung sa tingin mo ay hindi ito tumutugma sa iyong sitwasyon, huwag mag-atubiling makipag-ugnayan sa amin.',
    startOver: 'Simulan ulit',
  },
  loanCalculator: {
    title: 'Magkano kaya ang babayaran mo?',
    subtitle: 'Igalaw ang mga slider para makakuha ng instant na tantiya - walang kailangang account.',
    loanType: 'Uri ng loan',
    amountLabel: 'Halaga ng loan',
    termLabel: 'Termino (buwan)',
    monthlyPayment: 'Tinatayang buwanang bayad',
    totalRepayment: 'Kabuuang babayaran',
    disclaimer:
      'Sample computation lamang ito, hindi loan offer. Gumagamit ito ng flat 3%/buwan na rate bilang tantiya lamang - nag-iiba ang aktwal na interest rate depende sa loan product at termino, at ang final na rate at inaprubahang halaga ay depende sa buong credit evaluation ng Easycash.',
  },
  requirements: {
    title: 'Mga Kailangan sa Pag-apply',
    intro: 'Ang mga kailangan mong ihanda bago mag-apply. Ang pagpapahanda nito nang maaga ang gagawing mas mabilis sa iyong aplikasyon.',
    whoCanApply: 'Sino ang puwedeng mag-apply',
    eligibilityNote: 'Ang pagtugon sa mga ito ay hindi awtomatikong nangangahulugan ng pag-apruba - dumadaan ang bawat aplikasyon sa credit evaluation.',
    documentsHeading: 'Mga dokumento kada uri ng loan',
    documentsIntro: 'Puwede mong isumite muna ang iyong aplikasyon at i-upload ang mga ito pagkatapos, pero mas mabilis kung nakahanda na ang mga ito.',
    coBorrowerNote: 'Kung mag-a-apply ka na may co-borrower, kakailanganin din nila ng wastong ID.',
    readyHeading: 'Handa ka na bang mag-apply?',
    readyBody: 'Gumawa ng account at isumite ang iyong aplikasyon online - puwede mong i-save ang iyong progreso at bumalik dito anumang oras.',
  },
  securityTips: {
    title: 'Seguridad at Anti-Scam',
    intro: 'May mga manloloko na nagpapanggap na lehitimong lending company, kabilang ang Easycash. Sasabihin sa iyo ng pahinang ito kung ano ang hindi kailanman gagawin ng Easycash, para agad mong makilala ang peke.',
    alertTitle: 'Kung may humihingi sa iyo ng bayad bago ilabas ang iyong loan, iyon ay scam.',
    alertBody: 'Ito ang pinakakaraniwang scam na ginagamit laban sa mga nangungutang sa Pilipinas. Huminto, huwag magpadala ng pera, at ireport ito sa amin gamit ang mga channel sa ibaba.',
    neverDoesHeading: 'Ang hindi kailanman gagawin ng Easycash',
    neverDoes: [
      {
        title: 'Humingi ng bayad bago ilabas ang iyong loan',
        body: 'Hindi kailanman hihingi ang Easycash ng advance payment, "processing fee", "insurance fee", o "release fee" na ipapadala sa personal na GCash, Maya, o bank account bago ilabas ang iyong loan proceeds. Anumang mababawas na bayad ay isinasaad sa iyong mga dokumento ng loan at kinukuha mula mismo sa proceeds - hindi kailanman kinokolekta nang hiwalay bago ito.',
      },
      {
        title: 'Humingi ng iyong OTP, password, o PIN',
        body: 'Walang empleyado ng Easycash na hihingi ng iyong one-time PIN, password sa portal, PIN ng card, o mga kredensyal sa online banking - sa tawag, text, email, o chat man. Ang OTP ay para sa iyo lamang.',
      },
      {
        title: 'Papagbayarin ka sa personal na account',
        body: 'Ang mga bayad ay tinatanggap lamang sa opisyal na mga channel ng Easycash sa ilalim ng pangalan ng kompanya. Huwag kailanman magpadala ng pera sa personal na account ng isang tao, kahit sabihin nilang ahente o collector sila ng Easycash.',
      },
      {
        title: 'I-access ang iyong contacts o photo gallery sa telepono',
        body: 'Hindi kinukuha ng Easycash ang iyong contact list o mga larawan, at hindi kami nakikipag-ugnayan sa iyong pamilya, kaibigan, o employer para hiyain ka dahil sa utang. Ang sinumang lender na gumagawa nito ay lumalabag sa Data Privacy Act of 2012 at sa mga alituntunin ng SEC laban sa hindi makatarungang koleksyon ng utang.',
      },
      {
        title: 'Magbanta, mang-abuso, o hiyain ka nang publiko',
        body: 'Ang koleksyon ay isinasagawa nang legal at may paggalang. Ang mga banta ng pag-aresto, pampublikong pagsisiwalat, o mga mensahe sa iyong contacts ay hindi kasanayan ng Easycash - agad itong ireport sa amin.',
      },
    ],
    channelsHeading: 'Ang aming mga opisyal na channel',
    channelsIntro: 'Ito lamang ang mga channel na ginagamit ng Easycash. Kung may mensaheng dumating mula sa ibang lugar, ituring itong kahina-hinala.',
    channelLandline: 'Landline',
    channelSmart: 'Smart',
    channelGlobe: 'Globe',
    channelDpo: 'Data Privacy Officer',
    registeredOffice: 'Rehistradong opisina',
    protectHeading: 'Paano protektahan ang iyong sarili',
    protect: [
      'Beripikahin ang nagpadala. Ikumpara ang anumang numero o email sa aming opisyal na mga channel sa itaas bago ka sumagot.',
      'Suriin ang aming rehistrasyon. Ang Easycash ay rehistrado sa SEC - puwede mong beripikahin ang aming pangalan ng kompanya at rehistrasyon sa opisyal na website ng SEC.',
      'Huwag kailanman ibahagi ang OTP. Ituring itong parang pera: kapag naibigay na, wala na.',
      'Gumamit ng malakas at natatanging password para sa iyong Easycash Portal account, at huwag ito ulitin sa ibang site.',
      'Mag-log in lamang sa pamamagitan ng portal na ito. Huwag ilagay ang iyong kredensyal sa link na ipinadala sa text o chat - buksan mo mismo ang site.',
      'Panatilihing updated ang iyong contact details para maabot ka namin sa tamang channel.',
      'Basahin bago pumirma. Ipinapakita ng iyong disclosure statement ang kabuuang gastos ng iyong loan.',
    ],
    targetedHeading: 'Sa tingin mo ba ay naging target ka?',
    targetedBody: 'Ireport ito sa amin kaagad para maabisuhan namin ang ibang nangungutang - kahit hindi ka nawalan ng pera. Makipag-ugnayan sa amin sa pamamagitan ng kahit alin sa mga opisyal na channel sa itaas, o {complaintsLink}.',
    targetedLinkText: 'magsampa ng pormal na reklamo',
  },
  complaints: {
    title: 'Magsampa ng Reklamo',
    intro: 'Kung may nangyaring hindi maayos, gusto naming malaman ito nang direkta. Sineseryoso ng Easycash ang bawat reklamo, at ang pagsampa nito ay hindi kailanman makakaapekto sa pagproseso ng iyong loan.',
    reachUsHeading: 'Paano kami maaabot',
    byPhone: 'Sa telepono',
    inWriting: 'Sa pagsulat',
    inWritingNote: 'Para sa mga usaping data privacy at pormal na nakasulat na alalahanin.',
    mailTo: 'O sa koreo sa:',
    includeHeading: 'Ano ang isasama',
    includeIntro: 'Kung mas kumpleto ang iyong reklamo, mas mabilis namin itong maiimbestigahan.',
    include: [
      'Ang iyong buong pangalan at ang mobile number o email na nakarehistro sa iyong Easycash account',
      'Ang reference number ng iyong loan o aplikasyon, kung mayroon',
      'Malinaw na paglalarawan ng nangyari, kasama ang mga petsa',
      'Ang mga pangalan o numero ng kinausap mo, kung nauugnay',
      'Anumang screenshot, resibo, o dokumentong sumusuporta sa iyong reklamo',
      'Ang gusto mong maging resulta',
    ],
    privacyHeading: 'Mga alalahanin sa data privacy',
    privacyBody: 'Kung ang iyong alalahanin ay tungkol sa kung paano nakolekta, nagamit, o naibahagi ang iyong personal na impormasyon, ipadala ito sa aming Data Protection Officer sa {dpoEmail}. Ang iyong mga karapatan bilang data subject ay inilalarawan sa aming {privacyLink}. Puwede mo ring iharap ang usapin sa National Privacy Commission.',
    privacyLinkText: 'Pahayag ng Data Privacy',
    unresolvedHeading: 'Kung hindi namin ito maresolba',
    unresolvedBody: 'Ang Easycash ay umaandar sa ilalim ng Certificate of Authority mula sa Securities and Exchange Commission. Kung hindi pa rin nareresolba ang iyong reklamo pagkatapos itong iharap sa amin, puwede mo itong idulog sa SEC, na nangangasiwa sa mga lending company sa Pilipinas at may sariling consumer assistance channel.',
    scamHeading: 'Pag-uulat ng scam',
    scamBody: 'Kung may nagpapanggap na Easycash na humingi sa iyo ng advance fee, OTP, o bayad sa personal na account, ireport ito sa kahit alin sa mga channel sa itaas at basahin ang aming {securityLink} para makumpirma kung alin talaga ang aming mga channel.',
    scamLinkText: 'gabay sa Seguridad at Anti-Scam',
  },
  contact: {
    title: 'Makipag-ugnayan sa Amin',
    intro: 'Abutin ang Easycash sa pamamagitan ng kahit alin sa mga channel sa ibaba. Ito lamang ang aming opisyal na mga detalye ng contact.',
    phoneHeading: 'Telepono',
    emailHeading: 'Email',
    emailNote: 'Para sa mga usaping data privacy at pormal na nakasulat na alalahanin.',
    officeHeading: 'Rehistradong opisina',
    hoursHeading: 'Oras ng negosyo',
    impostorsHeading: 'Mag-ingat sa mga nagpapanggap',
    impostorsBody: 'Kung may nakipag-ugnayan sa iyo gamit ang numero o account na hindi nakalista sa pahinang ito habang nagpapanggap na Easycash, ituring itong scam. Basahin ang aming {securityLink}.',
    impostorsLinkText: 'gabay sa Seguridad at Anti-Scam',
    complaintHeading: 'May reklamo ka ba?',
    complaintBody: 'Mas gugustuhin naming malaman ito nang direkta. {complaintsLink} at aming susuriin ito.',
    complaintLinkText: 'Magsampa ng reklamo',
  },
  news: {
    title: 'Balita at mga Anunsyo',
    intro: 'Mga service advisory, gabay pinansyal, at update ng kompanya mula sa Easycash.',
    emptyTitle: 'Wala pang mga post',
    emptyBody: 'Lalabas dito ang mga anunsyo, service advisory, at gabay pinansyal ng Easycash. Bumalik ulit sa lalong madaling panahon.',
    filterAll: 'Lahat',
    backToAllNews: 'Bumalik sa lahat ng balita',
    notFoundTitle: 'Hindi natagpuan ang post',
    notFoundIntro: 'Maaaring inilipat o inalis na ang post na ito.',
  },
  notFound: {
    title: 'Hindi natagpuan ang pahina',
    intro: 'Ang pahinang iyong hinahanap ay hindi umiiral, o maaaring inilipat na ito.',
    whereHeading: 'Saan mo gustong pumunta?',
    linkHome: 'Home',
    linkRequirements: 'Mga Kailangan sa Pag-apply',
    linkNews: 'Balita at mga Anunsyo',
    linkSecurity: 'Seguridad at Anti-Scam',
    linkContact: 'Makipag-ugnayan sa Amin',
    backToHome: 'Bumalik sa home',
  },
};
