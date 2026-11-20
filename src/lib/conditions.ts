/*
  Library of common physiotherapy cases, for the report form: typing a complaint like "Cervical pain", "nyeri leher"
  or "tennis elbow" finds the case and fills in its usual mechanism of injury, which the physio then adjusts to the
  patient's own story. Names are as clinics write them; keywords cover English, Indonesian and everyday words.
  The same file lives in both apps (jade-physio and jade-report): change both.
*/

export interface Condition {
  name: string;
  /** Body region, for grouping the list. */
  region: string;
  /** Lowercase words or phrases that point to this case in a complaint. */
  keywords: string[];
  /** The usual mechanism of injury, as a starting point. */
  mechanism: string;
  /** A general case by body area ("Knee Pain"): picked from a complaint only when nothing more specific is in it,
   *  and listed first when searching. */
  general?: boolean;
  /** Spine level ("L4-L5") to the case for that level: "HNP" with "L4/L5" in the complaint becomes "HNP L4-L5". */
  levels?: Record<string, string>;
}

/* Disc problems by spine level: which nerve root each level presses on, where it is felt, and what goes weak. */
const SPINE: Record<string, { root: string; area: string; weak: string; neck: boolean }> = {
  "C4-C5": { root: "C5", area: "bahu dan lengan atas sisi luar", weak: "mengangkat lengan ke samping", neck: true },
  "C5-C6": { root: "C6", area: "lengan bawah sisi luar hingga ibu jari dan telunjuk", weak: "menekuk siku", neck: true },
  "C6-C7": { root: "C7", area: "lengan belakang hingga jari tengah", weak: "meluruskan siku", neck: true },
  "L3-L4": { root: "L4", area: "paha depan, lutut, dan tungkai bawah sisi dalam", weak: "meluruskan lutut", neck: false },
  "L4-L5": { root: "L5", area: "tungkai sisi luar hingga punggung kaki dan jempol", weak: "mengangkat jempol dan ujung kaki", neck: false },
  "L5-S1": { root: "S1", area: "bokong, paha dan betis belakang hingga tumit dan telapak kaki sisi luar", weak: "berjinjit", neck: false },
};
const BACK_LOAD = "Beban berulang saat membungkuk, mengangkat beban dengan punggung, duduk lama, atau proses degenerasi";
const NECK_LOAD = "Postur kepala menunduk atau maju dalam waktu lama (gawai, laptop), beban di bahu, atau proses degenerasi";
const BACK_TEAR = "Mengangkat beban sambil membungkuk dan memutar badan, atau beban berulang pada diskus yang sudah mengalami degenerasi,";
const NECK_TEAR = "Gerakan atau beban mendadak pada leher, atau postur menunduk lama pada diskus yang sudah mengalami degenerasi,";

export const CONDITIONS: Condition[] = [
  // ---------- Leher ----------
  {
    name: "Cervical Pain",
    region: "Leher",
    general: true,
    keywords: ["cervical pain", "neck pain", "nyeri leher", "sakit leher", "leher kaku", "leher tegang", "tengeng", "salah bantal", "kaku leher"],
    mechanism:
      "Postur leher menunduk atau maju dalam waktu lama (gawai, laptop, menyetir), posisi tidur yang salah, atau stres membuat otot leher dan bahu atas tegang terus-menerus sehingga timbul spasme dan nyeri.",
  },
  {
    name: "Cervical Radiculopathy",
    region: "Leher",
    keywords: ["cervical radiculopathy", "radikulopati servikal", "saraf terjepit leher", "saraf kejepit leher", "nyeri leher menjalar", "kesemutan tangan", "pinched nerve neck"],
    mechanism:
      "Penekanan akar saraf leher oleh penonjolan bantalan sendi (HNP) atau pengapuran tulang leher, dipicu degenerasi, postur buruk berkepanjangan, atau gerakan/beban mendadak, sehingga nyeri menjalar ke bahu, lengan, atau jari disertai kesemutan.",
  },
  {
    name: "Whiplash Injury",
    region: "Leher",
    keywords: ["whiplash", "cedera leher kecelakaan", "leher tersentak", "kecelakaan motor leher", "kecelakaan mobil leher"],
    mechanism:
      "Gerakan leher tersentak cepat ke belakang lalu ke depan (biasanya tabrakan kendaraan atau jatuh) meregangkan otot, ligamen, dan sendi faset leher melebihi batasnya.",
  },
  {
    name: "Cervicogenic Headache",
    region: "Leher",
    keywords: ["cervicogenic headache", "sakit kepala dari leher", "pusing tegang leher", "tension headache", "sakit kepala tegang"],
    mechanism:
      "Ketegangan otot dan kekakuan sendi leher atas akibat postur menunduk lama dan stres memicu nyeri yang menjalar dari tengkuk ke kepala.",
  },
  {
    name: "Trapezius Myalgia",
    region: "Leher",
    keywords: ["trapezius", "myofascial", "myalgia", "pundak kaku", "pundak tegang", "pundak pegal", "bahu atas tegang", "bahu pegal", "trigger point"],
    mechanism:
      "Otot trapezius bekerja terus-menerus karena postur bahu terangkat, membawa tas berat di satu sisi, atau kerja depan komputer lama, sehingga terbentuk titik picu (trigger point) yang nyeri.",
  },
  // ---------- Bahu ----------
  {
    name: "Frozen Shoulder",
    region: "Bahu",
    keywords: ["frozen shoulder", "frozen", "adhesive capsulitis", "bahu beku", "bahu kaku", "susah angkat tangan", "tidak bisa angkat tangan"],
    mechanism:
      "Kapsul sendi bahu meradang lalu menebal dan mengerut, sering setelah bahu jarang digerakkan (cedera, operasi) atau pada penderita diabetes, sehingga gerak bahu makin terbatas ke semua arah.",
  },
  {
    name: "Rotator Cuff Tendinopathy",
    region: "Bahu",
    keywords: ["rotator cuff", "supraspinatus", "tendinitis bahu", "tendinopati bahu", "nyeri bahu angkat"],
    mechanism:
      "Beban berulang dengan lengan di atas bahu (mengangkat barang ke rak, olahraga raket, renang) atau mengangkat beban berat melebihi kapasitas tendon menimbulkan iritasi dan degenerasi tendon rotator cuff.",
  },
  {
    name: "Shoulder Impingement",
    region: "Bahu",
    keywords: ["impingement", "subacromial", "bahu terjepit", "painful arc"],
    mechanism:
      "Tendon dan bursa di bawah akromion terjepit saat lengan diangkat berulang, diperberat postur bahu membungkuk ke depan dan otot stabilisator skapula yang lemah.",
  },
  {
    name: "Shoulder Dislocation",
    region: "Bahu",
    keywords: ["dislokasi bahu", "shoulder dislocation", "bahu lepas", "bahu keluar sendi"],
    mechanism:
      "Jatuh dengan tangan menumpu atau benturan saat lengan terangkat dan berputar keluar mendorong kepala tulang lengan atas keluar dari mangkuk sendi bahu, merobek kapsul dan ligamen.",
  },
  // ---------- Siku, pergelangan & tangan ----------
  {
    name: "Tennis Elbow",
    region: "Siku",
    keywords: ["tennis elbow", "lateral epicondylitis", "lateral epicondylalgia", "epikondilitis lateral", "nyeri siku luar", "siku luar"],
    mechanism:
      "Penggunaan berulang otot ekstensor pergelangan tangan (menggenggam, mengetik, memakai mouse, mengangkat dengan telapak menghadap bawah, olahraga raket) menimbulkan beban berlebih dan mikro-robekan pada tendon di sisi luar siku.",
  },
  {
    name: "Golfer's Elbow",
    region: "Siku",
    keywords: ["golfer's elbow", "golfers elbow", "medial epicondylitis", "epikondilitis medial", "nyeri siku dalam", "siku dalam"],
    mechanism:
      "Gerakan menekuk pergelangan dan menggenggam kuat yang berulang (golf, angkat beban, pekerjaan tangan) membebani tendon otot fleksor di sisi dalam siku.",
  },
  {
    name: "De Quervain's Tenosynovitis",
    region: "Pergelangan tangan",
    keywords: ["de quervain", "dequervain", "nyeri ibu jari", "pergelangan sisi ibu jari", "mommy thumb"],
    mechanism:
      "Gerakan ibu jari dan pergelangan yang berulang (menggendong bayi, mengetik di ponsel, memeras) membuat selubung tendon di sisi ibu jari meradang dan menebal.",
  },
  {
    name: "Carpal Tunnel Syndrome",
    region: "Pergelangan tangan",
    keywords: ["carpal tunnel", "cts", "kesemutan jari", "tangan kebas", "baal tangan", "jari kesemutan"],
    mechanism:
      "Saraf medianus tertekan di terowongan karpal akibat gerakan pergelangan berulang, posisi menekuk lama (mengetik, menjahit), pembengkakan saat hamil, atau diabetes, sehingga jari kesemutan dan kebas terutama malam hari.",
  },
  {
    name: "Trigger Finger",
    region: "Tangan",
    keywords: ["trigger finger", "jari pelatuk", "jari terkunci", "jari macet"],
    mechanism: "Menggenggam kuat berulang membuat selubung tendon fleksor jari menebal sehingga tendon tersangkut saat jari ditekuk lalu diluruskan.",
  },
  {
    name: "Wrist Sprain",
    region: "Pergelangan tangan",
    keywords: ["wrist sprain", "keseleo pergelangan tangan", "terkilir pergelangan tangan", "pergelangan tangan terkilir"],
    mechanism: "Jatuh dengan tangan terbuka menumpu badan atau tangan terpelintir paksa meregangkan hingga merobek ligamen pergelangan tangan.",
  },
  // ---------- Punggung & pinggang ----------
  {
    name: "Low Back Pain",
    region: "Punggung bawah",
    general: true,
    keywords: ["low back pain", "lbp", "nyeri punggung bawah", "nyeri pinggang", "sakit pinggang", "pinggang kaku", "encok", "boyok"],
    mechanism:
      "Mengangkat beban dengan punggung membungkuk, duduk lama dengan postur buruk, gerakan memutar mendadak, atau otot inti yang lemah membebani otot, ligamen, dan sendi punggung bawah sehingga timbul spasme dan nyeri.",
  },
  {
    name: "Lumbar Disc Herniation (HNP)",
    region: "Punggung bawah",
    keywords: ["hnp", "herniated disc", "disc herniation", "saraf kejepit", "saraf terjepit pinggang", "bantalan tulang", "slipped disc", "hernia nukleus pulposus", "herniasi diskus"],
    mechanism:
      "Mengangkat beban sambil membungkuk dan memutar badan, atau degenerasi bantalan sendi tulang belakang, membuat inti bantalan (nukleus) menonjol keluar dan menekan akar saraf pinggang.",
    levels: Object.fromEntries(Object.keys(SPINE).map((lv) => [lv, `HNP ${lv}`])),
  },
  {
    name: "Sciatica",
    region: "Punggung bawah",
    keywords: ["sciatica", "siatika", "skiatika", "nyeri menjalar ke kaki", "menjalar ke kaki", "menjalar ke tungkai", "nyeri pinggang menjalar", "nyeri pantat ke kaki", "saraf sciatic"],
    mechanism:
      "Iritasi atau penekanan saraf sciatic, umumnya oleh HNP lumbal, penyempitan kanal, atau otot piriformis yang tegang, menimbulkan nyeri menjalar dari pinggang/bokong ke tungkai.",
  },
  {
    name: "Lumbar Spondylosis",
    region: "Punggung bawah",
    keywords: ["spondylosis", "spondilosis", "pengapuran tulang belakang", "pengapuran pinggang", "degeneratif lumbal"],
    mechanism: "Proses degenerasi karena usia dan beban kerja bertahun-tahun mengurangi tinggi bantalan sendi dan membentuk osteofit, sehingga pinggang kaku dan nyeri terutama pagi hari.",
  },
  {
    name: "Thoracic Back Pain",
    region: "Punggung atas",
    general: true,
    keywords: ["thoracic pain", "nyeri punggung atas", "punggung atas", "nyeri belikat", "sela belikat"],
    mechanism: "Duduk membungkuk lama di depan komputer dan kurang gerak membuat sendi punggung atas kaku serta otot di sekitar belikat tegang.",
  },
  {
    name: "Scoliosis",
    region: "Punggung",
    keywords: ["scoliosis", "skoliosis", "tulang belakang bengkok", "punggung miring"],
    mechanism:
      "Lengkung tulang belakang ke samping, umumnya idiopatik pada masa pertumbuhan, atau fungsional akibat kebiasaan postur dan ketidakseimbangan otot, sehingga otot satu sisi bekerja lebih berat dan cepat lelah atau nyeri.",
  },
  {
    name: "Postural Syndrome",
    region: "Punggung",
    keywords: ["postural", "postur buruk",  "forward head", "upper crossed"],
    mechanism: "Kebiasaan postur membungkuk dan kepala maju saat duduk, bekerja, atau bermain gawai dalam waktu lama membebani jaringan lunak tulang belakang secara terus-menerus.",
  },
  // ---------- Panggul ----------
  {
    name: "Piriformis Syndrome",
    region: "Panggul",
    keywords: ["piriformis", "nyeri bokong", "nyeri pantat"],
    mechanism: "Otot piriformis yang tegang atau meradang akibat duduk lama, lari, atau trauma pada bokong menekan saraf sciatic di bawahnya.",
  },
  {
    name: "Hip Osteoarthritis",
    region: "Panggul",
    keywords: ["hip osteoarthritis", "oa panggul", "pengapuran panggul", "nyeri pangkal paha", "sendi panggul"],
    mechanism: "Degenerasi tulang rawan sendi panggul karena usia, beban berlebih, berat badan, atau riwayat cedera membuat sendi nyeri dan kaku saat berjalan.",
  },
  {
    name: "Groin Strain",
    region: "Panggul",
    keywords: ["groin strain", "adductor strain", "cedera selangkangan", "nyeri selangkangan", "paha dalam"],
    mechanism: "Gerakan menendang, mengubah arah tiba-tiba, atau membuka kaki lebar saat olahraga meregangkan berlebih otot adduktor paha dalam.",
  },
  // ---------- Lutut ----------
  {
    name: "Knee Osteoarthritis",
    region: "Lutut",
    keywords: ["knee osteoarthritis", "osteoarthritis knee", "osteoarthritis genu", "osteoarthritis lutut", "osteoartritis lutut", "knee oa", "oa knee", "oa genu", "oa lutut", "pengapuran lutut", "lutut nyeri naik tangga", "lutut bunyi"],
    mechanism:
      "Degenerasi tulang rawan sendi lutut karena usia, berat badan berlebih, beban berulang, atau riwayat cedera lutut membuat sendi nyeri, kaku, dan kadang bengkak, terutama saat naik-turun tangga atau jongkok.",
  },
  {
    name: "ACL Injury",
    region: "Lutut",
    keywords: ["acl", "anterior cruciate", "ligamen lutut", "lutut goyang"],
    mechanism:
      "Pendaratan setelah melompat, berhenti mendadak, atau memutar badan dengan kaki tertumpu (futsal, basket, badminton) membuat lutut tertekuk ke dalam dan berputar, merobek ligamen ACL.",
  },
  {
    name: "Meniscus Tear",
    region: "Lutut",
    keywords: ["meniscus", "meniskus", "robek meniskus", "lutut terkunci", "lutut mengunci"],
    mechanism: "Lutut berputar saat menumpu badan, atau jongkok dalam dan bangkit tiba-tiba, menjepit dan merobek meniskus; pada usia lanjut dapat terjadi akibat degenerasi.",
  },
  {
    name: "MCL Sprain",
    region: "Lutut",
    keywords: ["mcl", "medial collateral", "ligamen dalam lutut", "lutut sisi dalam"],
    mechanism: "Benturan dari sisi luar lutut atau gerakan lutut tertekuk ke dalam saat kaki tertumpu meregangkan ligamen kolateral medial.",
  },
  {
    name: "Patellofemoral Pain Syndrome",
    region: "Lutut",
    keywords: ["patellofemoral", "pfps", "runner's knee", "nyeri tempurung lutut", "nyeri lutut depan"],
    mechanism:
      "Beban berulang pada sendi tempurung lutut (lari, naik tangga, jongkok) dengan otot paha depan dan panggul yang lemah membuat tempurung bergerak tidak seimbang dan menimbulkan nyeri lutut depan.",
  },
  {
    name: "Patellar Tendinopathy",
    region: "Lutut",
    keywords: ["patellar tendinopathy", "jumper's knee", "tendinitis patella", "nyeri bawah tempurung"],
    mechanism: "Melompat dan mendarat berulang (voli, basket) memberi beban berlebih pada tendon patella di bawah tempurung lutut.",
  },
  // ---------- Pergelangan kaki & kaki ----------
  {
    name: "Ankle Sprain",
    region: "Pergelangan kaki",
    keywords: ["ankle sprain", "keseleo", "terkilir", "pergelangan kaki terkilir", "kaki terkilir", "keseleo kaki"],
    mechanism:
      "Salah tumpu: kaki terpijak atau mendarat pada posisi telapak menghadap ke dalam (inversi), misalnya saat bermain bola atau futsal, menuruni tangga, atau jalan di permukaan tidak rata, meregangkan hingga merobek ligamen sisi luar pergelangan kaki.",
  },
  {
    name: "Achilles Tendinopathy",
    region: "Pergelangan kaki",
    keywords: ["achilles", "tendon achilles", "nyeri tumit belakang", "betis bawah"],
    mechanism: "Peningkatan beban lari atau lompat yang terlalu cepat, sepatu kurang sesuai, dan otot betis yang kaku memberi beban berulang berlebih pada tendon Achilles.",
  },
  {
    name: "Plantar Fasciitis",
    region: "Kaki",
    keywords: ["plantar fasciitis", "plantar fasciopathy", "nyeri tumit", "telapak kaki", "tumit sakit pagi", "taji tumit", "heel spur"],
    mechanism:
      "Beban berulang pada telapak kaki (berdiri atau berjalan lama, lari, berat badan berlebih, alas kaki datar) dengan otot betis yang kaku membuat fascia plantaris teriritasi, khas nyeri tumit pada langkah pertama pagi hari.",
  },
  {
    name: "Shin Splints",
    region: "Tungkai bawah",
    keywords: ["shin splints", "mtss", "medial tibial stress", "nyeri tulang kering"],
    mechanism: "Peningkatan intensitas lari atau lompat yang mendadak, terutama di permukaan keras, membebani berulang otot dan lapisan tulang kering bagian dalam.",
  },
  // ---------- Otot ----------
  {
    name: "Hamstring Strain",
    region: "Paha",
    keywords: ["hamstring", "paha belakang", "cedera paha belakang", "tarikan paha belakang"],
    mechanism: "Sprint atau menendang saat otot hamstring memanjang sambil berkontraksi kuat, apalagi tanpa pemanasan cukup atau saat lelah, merobek serabut otot paha belakang.",
  },
  {
    name: "Quadriceps Strain / Contusion",
    region: "Paha",
    keywords: ["quadriceps", "paha depan", "memar paha", "cedera paha depan"],
    mechanism: "Menendang atau sprint mendadak meregangkan otot paha depan, atau benturan langsung (lutut lawan, terjatuh) menimbulkan memar dalam otot.",
  },
  {
    name: "Calf Strain",
    region: "Tungkai bawah",
    keywords: ["calf strain", "betis tertarik", "otot betis tertarik", "betis robek", "cedera betis", "tennis leg"],
    mechanism: "Dorongan tiba-tiba saat berlari atau melompat dengan lutut lurus meregangkan otot betis melebihi kapasitasnya.",
  },
  // ---------- Neurologi & lainnya ----------
  {
    name: "Post-Stroke",
    region: "Neurologi",
    keywords: ["stroke", "pasca stroke", "post stroke", "hemiparese", "hemiparesis", "lumpuh sebelah", "cva"],
    mechanism:
      "Gangguan aliran darah ke otak (sumbatan atau pecah pembuluh darah) merusak jaringan otak yang mengatur gerak, sehingga terjadi kelemahan atau kekakuan pada satu sisi tubuh serta gangguan keseimbangan dan berjalan.",
  },
  {
    name: "Bell's Palsy",
    region: "Neurologi",
    keywords: ["bell's palsy", "bells palsy", "wajah mencong", "mulut mencong", "lumpuh wajah", "facial palsy"],
    mechanism: "Peradangan saraf wajah (nervus fasialis), sering setelah infeksi virus atau paparan angin/dingin, menyebabkan kelemahan otot satu sisi wajah.",
  },
  {
    name: "Post-Fracture Rehabilitation",
    region: "Pasca operasi",
    keywords: ["fraktur", "fracture", "patah tulang", "pasca patah", "post orif", "orif", "gips"],
    mechanism: "Patah tulang akibat jatuh, kecelakaan, atau benturan; setelah imobilisasi (gips atau operasi) sendi di sekitarnya kaku dan otot melemah karena lama tidak digerakkan.",
  },
  {
    name: "Post-Operative Knee Replacement",
    region: "Pasca operasi",
    keywords: ["tkr", "tka", "knee replacement", "ganti lutut", "pasca operasi lutut"],
    mechanism: "Penggantian sendi lutut karena kerusakan sendi berat (umumnya OA lanjut); setelah operasi lutut nyeri, bengkak, kaku, dan otot paha lemah.",
  },
  {
    name: "Temporomandibular Disorder",
    region: "Rahang",
    keywords: ["tmj", "tmd", "temporomandibular", "nyeri rahang", "rahang bunyi", "rahang kaku"],
    mechanism: "Kebiasaan menggertakkan gigi, mengunyah satu sisi, stres, atau membuka mulut terlalu lebar membebani sendi dan otot rahang.",
  },
  // ---------- Tulang belakang: diskus per ruas ----------
  {
    name: "Disc Bulging",
    region: "Tulang belakang",
    keywords: ["disc bulging", "bulging disc", "disk bulging", "bulging", "protrusi diskus", "penonjolan diskus", "diskus menonjol", "bantalan tulang menonjol"],
    mechanism:
      "Beban berulang pada bantalan sendi tulang belakang (diskus), seperti membungkuk, mengangkat beban, duduk lama, atau proses degenerasi, membuat cincin luar diskus melemah sehingga diskus menggembung ke belakang dan dapat mengiritasi akar saraf di dekatnya.",
    levels: Object.fromEntries(Object.keys(SPINE).map((lv) => [lv, `Disc Bulging ${lv}`])),
  },
  ...Object.entries(SPINE).flatMap(([lv, s]) => [
    {
      name: `Disc Bulging ${lv}`,
      region: s.neck ? "Leher" : "Punggung bawah",
      keywords: [`disc bulging ${lv}`, `bulging ${lv}`, `protrusi ${lv}`].map((k) => k.toLowerCase()),
      mechanism: `${s.neck ? NECK_LOAD : BACK_LOAD} membuat cincin luar diskus ${lv} (annulus fibrosus) melemah sehingga diskus menggembung ke belakang. Tonjolan ini dapat mengiritasi akar saraf ${s.root}: nyeri, kesemutan, atau baal menjalar ke ${s.area}.`,
    },
    {
      name: `HNP ${lv}`,
      region: s.neck ? "Leher" : "Punggung bawah",
      keywords: [`hnp ${lv}`, `herniasi ${lv}`, `herniated disc ${lv}`, `saraf terjepit ${lv}`, `saraf kejepit ${lv}`].map((k) => k.toLowerCase()),
      mechanism: `${s.neck ? NECK_TEAR : BACK_TEAR} merobek cincin luar diskus ${lv} sehingga inti diskus (nukleus pulposus) keluar dan menekan akar saraf ${s.root}: nyeri menjalar ke ${s.area}, kesemutan atau baal, dan bisa disertai lemah ${s.weak}.`,
    },
  ]),
  {
    name: "Cervical Disc Herniation (HNP)",
    region: "Leher",
    keywords: ["hnp servikal", "hnp cervical", "hnp leher", "cervical disc herniation", "herniasi diskus leher", "bantalan tulang leher"],
    mechanism:
      "Gerakan atau beban mendadak pada leher, atau postur menunduk lama pada bantalan sendi leher yang sudah mengalami degenerasi, membuat inti bantalan keluar dan menekan akar saraf leher: nyeri menjalar ke bahu, lengan, atau jari disertai kesemutan.",
    levels: Object.fromEntries(Object.keys(SPINE).filter((lv) => SPINE[lv].neck).map((lv) => [lv, `HNP ${lv}`])),
  },
  {
    name: "Spondylolisthesis",
    region: "Punggung bawah",
    keywords: ["spondylolisthesis", "spondilolistesis", "listesis", "pergeseran tulang belakang", "tulang belakang bergeser", "ruas tulang bergeser"],
    mechanism:
      "Satu ruas tulang belakang bergeser ke depan terhadap ruas di bawahnya, karena retak kecil pada bagian belakang ruas (sering pada olahraga yang banyak menengadah) atau degenerasi sendi faset dan diskus pada usia lanjut, sehingga pinggang nyeri saat berdiri lama dan menengadah.",
    levels: { "L4-L5": "Spondylolisthesis L4-L5", "L5-S1": "Spondylolisthesis L5-S1" },
  },
  {
    name: "Spondylolisthesis L4-L5",
    region: "Punggung bawah",
    keywords: ["spondylolisthesis l4 l5", "listesis l4 l5"],
    mechanism:
      "Ruas L4 bergeser ke depan terhadap L5, umumnya karena degenerasi sendi faset dan diskus pada usia lanjut, sehingga kanal dan lubang saraf menyempit: pinggang nyeri saat berdiri lama atau menengadah, dan dapat menjalar ke tungkai (akar saraf L5).",
  },
  {
    name: "Spondylolisthesis L5-S1",
    region: "Punggung bawah",
    keywords: ["spondylolisthesis l5 s1", "listesis l5 s1"],
    mechanism:
      "Ruas L5 bergeser ke depan terhadap S1, sering karena retak kecil pada bagian belakang ruas L5 (spondylolysis) akibat gerakan menengadah berulang saat olahraga, sehingga pinggang bawah nyeri dan otot hamstring tegang, kadang menjalar ke tungkai.",
  },
  {
    name: "Lumbar Spinal Stenosis",
    region: "Punggung bawah",
    keywords: ["spinal stenosis", "stenosis", "stenosis lumbal", "penyempitan kanal", "canal stenosis", "penyempitan saraf tulang belakang", "kaki berat saat jalan", "neurogenic claudication"],
    mechanism:
      "Degenerasi diskus, penebalan ligamen, dan pengapuran sendi faset menyempitkan kanal tulang belakang pinggang sehingga saraf tertekan: tungkai terasa berat, kesemutan, atau nyeri saat berdiri dan berjalan, membaik bila duduk atau membungkuk.",
  },
  {
    name: "Facet Joint Syndrome",
    region: "Punggung bawah",
    keywords: ["facet", "facet joint", "facet syndrome", "sendi faset", "nyeri saat menengadah", "nyeri saat melenting"],
    mechanism:
      "Beban berulang pada sendi faset tulang belakang saat menengadah dan memutar badan, ditambah degenerasi atau diskus yang menipis, membuat sendi kecil di belakang ruas tulang meradang: nyeri pinggang setempat yang bertambah saat menengadah.",
  },
  {
    name: "Lumbar Strain",
    region: "Punggung bawah",
    keywords: ["lumbar strain", "otot pinggang tertarik", "keseleo pinggang", "pinggang terkilir", "spasme otot pinggang", "pinggang ketarik", "pinggang kecetit", "kecetit"],
    mechanism:
      "Mengangkat atau memutar badan secara mendadak, terutama saat otot belum siap atau lelah, membuat otot dan ligamen pinggang teregang berlebihan hingga robek kecil dan spasme.",
  },
  {
    name: "Sacroiliac Joint Dysfunction",
    region: "Panggul",
    keywords: ["sacroiliac", "sakroiliaka", "si joint", "sij", "sendi sakroiliaka", "nyeri sakroiliaka", "nyeri pinggul belakang"],
    mechanism:
      "Beban tidak seimbang pada panggul (berdiri bertumpu satu kaki, beda panjang tungkai), jatuh terduduk, kehamilan, atau setelah melahirkan membuat sendi antara tulang kelangkang dan panggul terlalu longgar atau kaku sehingga nyeri di pinggul belakang.",
  },
  {
    name: "Coccydynia",
    region: "Punggung bawah",
    keywords: ["coccydynia", "koksigodinia", "nyeri tulang ekor", "tulang ekor", "jatuh terduduk"],
    mechanism: "Jatuh terduduk, duduk lama di permukaan keras, atau proses melahirkan membebani dan mencederai tulang ekor beserta ligamennya, sehingga nyeri saat duduk.",
  },
  {
    name: "Vertebral Compression Fracture",
    region: "Punggung",
    keywords: ["compression fracture", "fraktur kompresi", "tulang belakang retak", "osteoporosis tulang belakang", "fraktur vertebra"],
    mechanism:
      "Ruas tulang belakang yang rapuh karena osteoporosis retak dan memendek akibat beban ringan seperti jatuh terduduk, membungkuk, atau mengangkat barang, sehingga nyeri punggung mendadak dan postur makin membungkuk.",
  },
  {
    name: "Ankylosing Spondylitis",
    region: "Punggung",
    keywords: ["ankylosing spondylitis", "ankylosing", "spondilitis ankilosa", "bechterew"],
    mechanism:
      "Peradangan autoimun pada sendi tulang belakang dan sendi sakroiliaka, bukan karena cedera, yang lama-lama membuat tulang belakang kaku; nyeri dan kaku terutama pagi hari dan membaik dengan bergerak.",
  },
  {
    name: "Post-Operative Spine",
    region: "Pasca operasi",
    keywords: ["pasca operasi tulang belakang", "post op tulang belakang", "laminectomy", "laminektomi", "pasca operasi hnp", "spinal fusion", "fusi tulang belakang", "discectomy", "diskektomi"],
    mechanism:
      "Operasi tulang belakang (diskektomi, laminektomi, atau fusi) untuk membebaskan saraf atau menstabilkan ruas; setelah operasi otot punggung dan perut lemah, gerak terbatas, dan perlu latihan bertahap agar tidak kambuh.",
  },
  // ---------- Leher ----------
  {
    name: "Cervical Spondylosis",
    region: "Leher",
    keywords: ["cervical spondylosis", "spondilosis servikal", "spondylosis cervical", "pengapuran leher", "pengapuran tulang leher", "degeneratif servikal"],
    mechanism:
      "Degenerasi karena usia, postur menunduk bertahun-tahun, dan beban kerja menipiskan bantalan sendi leher dan membentuk osteofit, sehingga leher kaku, nyeri, dan kadang menekan saraf ke lengan.",
  },
  {
    name: "Torticollis",
    region: "Leher",
    keywords: ["torticollis", "tortikolis", "leher miring", "kepala miring", "wry neck"],
    mechanism:
      "Pada dewasa: tidur dengan posisi leher salah atau gerakan mendadak membuat otot leher spasme sehingga kepala tertarik miring. Pada bayi: otot sternokleidomastoid memendek karena posisi dalam kandungan atau proses persalinan.",
  },
  {
    name: "Thoracic Outlet Syndrome",
    region: "Leher",
    keywords: ["thoracic outlet", "thoracic outlet syndrome", "tos", "kesemutan lengan saat angkat tangan"],
    mechanism:
      "Saraf dan pembuluh darah ke lengan tertekan di antara otot scalene, tulang selangka, dan iga pertama, akibat bahu yang turun dan membungkuk, gerakan tangan di atas kepala berulang, atau iga tambahan, sehingga lengan kesemutan dan cepat lelah.",
  },
  // ---------- Bahu ----------
  {
    name: "Rotator Cuff Tear",
    region: "Bahu",
    keywords: ["rotator cuff tear", "cuff tear", "robek rotator cuff", "robekan tendon bahu", "tendon bahu robek", "rct"],
    mechanism:
      "Jatuh dengan tangan menumpu, mengangkat beban berat secara mendadak, atau tendon yang sudah menipis karena usia dan gerakan di atas kepala berulang membuat tendon rotator cuff robek, sehingga lengan lemah dan nyeri saat diangkat.",
  },
  {
    name: "Bicipital Tendinopathy",
    region: "Bahu",
    keywords: ["bicipital", "biceps tendinitis", "bicep tendinitis", "tendinitis biseps", "tendinopati biseps", "nyeri bahu depan", "long head biceps"],
    mechanism: "Gerakan mengangkat, melempar, atau membawa beban berulang dengan lengan di depan badan membebani tendon biseps di depan bahu hingga meradang.",
  },
  {
    name: "Subacromial Bursitis",
    region: "Bahu",
    keywords: ["subacromial bursitis", "bursitis subakromial", "bursitis bahu"],
    mechanism: "Gerakan mengangkat tangan ke atas kepala berulang atau jepitan di bawah atap bahu (impingement) mengiritasi kantung cairan (bursa) di atas tendon bahu sehingga meradang dan nyeri.",
  },
  {
    name: "Calcific Tendinitis",
    region: "Bahu",
    keywords: ["calcific tendinitis", "calcific tendinopathy", "tendinitis kalsifikasi", "kalsifikasi bahu", "pengapuran tendon bahu", "pengapuran bahu"],
    mechanism: "Endapan kalsium terbentuk di tendon rotator cuff, umumnya pada usia 30–50 tahun tanpa cedera yang jelas; saat endapan diserap tubuh, bahu bisa mendadak sangat nyeri.",
  },
  {
    name: "AC Joint Sprain",
    region: "Bahu",
    keywords: ["ac joint", "acromioclavicular", "sendi ac", "cedera ujung bahu", "separasi bahu", "shoulder separation"],
    mechanism: "Jatuh langsung di ujung bahu (olahraga, jatuh dari motor atau sepeda) meregangkan hingga merobek ligamen sendi antara tulang selangka dan acromion.",
  },
  {
    name: "SLAP Lesion",
    region: "Bahu",
    keywords: ["slap lesion", "slap tear", "labrum bahu", "robek labrum bahu", "labral tear bahu"],
    mechanism: "Gerakan melempar berulang, jatuh dengan tangan menumpu, atau tarikan mendadak pada lengan merobek bibir sendi (labrum) bahu bagian atas tempat tendon biseps melekat.",
  },
  {
    name: "Scapular Dyskinesis",
    region: "Bahu",
    keywords: ["scapular dyskinesis", "dyskinesis", "winging scapula", "scapula winging"],
    mechanism: "Otot penstabil belikat (serratus anterior, trapezius bawah) lemah atau sarafnya cedera, sehingga gerak belikat tidak terkendali saat lengan diangkat dan bahu mudah nyeri.",
  },
  {
    name: "Post-Operative Shoulder",
    region: "Pasca operasi",
    keywords: ["pasca operasi bahu", "post op bahu", "operasi bahu", "rotator cuff repair", "bankart repair", "artroskopi bahu"],
    mechanism: "Perbaikan tendon atau labrum bahu dengan operasi, diikuti masa imobilisasi dengan arm sling, membuat bahu kaku dan otot sekitarnya lemah.",
  },
  // ---------- Siku, pergelangan, tangan ----------
  {
    name: "Cubital Tunnel Syndrome",
    region: "Siku",
    keywords: ["cubital tunnel", "ulnar neuropathy", "saraf ulnaris", "kesemutan kelingking", "kelingking kesemutan", "jari manis kesemutan"],
    mechanism: "Siku ditekuk lama (menelepon, tidur dengan siku tertekuk) atau sering bertumpu pada siku menekan saraf ulnaris di siku dalam, sehingga jari manis dan kelingking kesemutan.",
  },
  {
    name: "Olecranon Bursitis",
    region: "Siku",
    keywords: ["olecranon bursitis", "bursitis siku", "siku bengkak", "benjolan siku"],
    mechanism: "Sering bertumpu pada siku atau benturan langsung mengiritasi kantung cairan (bursa) di ujung siku hingga bengkak.",
  },
  {
    name: "Distal Radius Fracture",
    region: "Pergelangan tangan",
    keywords: ["distal radius", "fraktur radius distal", "fraktur colles", "colles", "patah pergelangan tangan", "pergelangan tangan patah"],
    mechanism: "Jatuh dengan tangan terbuka menumpu badan mematahkan ujung tulang radius dekat pergelangan; setelah gips atau operasi, pergelangan dan jari kaku dan lemah.",
  },
  {
    name: "TFCC Injury",
    region: "Pergelangan tangan",
    keywords: ["tfcc", "triangular fibrocartilage", "nyeri pergelangan sisi kelingking", "pergelangan tangan sisi kelingking"],
    mechanism: "Jatuh dengan tangan menumpu sambil terpuntir, atau gerakan memutar pergelangan berulang (raket, mengangkat beban) mencederai bantalan tulang rawan di sisi kelingking pergelangan tangan.",
  },
  {
    name: "Repetitive Strain Injury",
    region: "Pergelangan tangan",
    keywords: ["repetitive strain injury", "rsi", "nyeri saat mengetik", "nyeri tangan mengetik", "pergelangan tangan nyeri", "nyeri tangan main hp"],
    mechanism: "Gerakan tangan yang sama berulang dalam waktu lama (mengetik, memakai mouse, gawai) dengan posisi pergelangan menekuk dan jarang istirahat membebani otot dan tendon lengan bawah hingga nyeri.",
  },
  {
    name: "Ganglion Cyst",
    region: "Pergelangan tangan",
    keywords: ["ganglion", "kista ganglion", "benjolan pergelangan tangan"],
    mechanism: "Cairan sendi atau sarung tendon keluar membentuk kantung (kista) di pergelangan tangan, sering terkait beban atau gerakan pergelangan berulang.",
  },
  {
    name: "Hand Osteoarthritis",
    region: "Tangan",
    keywords: ["oa tangan", "osteoarthritis tangan", "osteoarthritis jari", "pengapuran jari", "sendi jari kaku", "heberden", "pangkal ibu jari"],
    mechanism: "Degenerasi tulang rawan sendi jari dan pangkal ibu jari karena usia dan gerakan menggenggam berulang, sehingga jari kaku, nyeri, dan sendi membesar.",
  },
  {
    name: "Finger Sprain",
    region: "Tangan",
    keywords: ["finger sprain", "jari terkilir", "keseleo jari", "jari keseleo", "jari bengkak"],
    mechanism: "Bola atau benturan mengenai ujung jari, atau jari tertekuk paksa (voli, basket), meregangkan ligamen sendi jari sehingga bengkak dan nyeri.",
  },
  {
    name: "Mallet Finger",
    region: "Tangan",
    keywords: ["mallet finger", "jari palu", "ujung jari tidak bisa lurus", "ujung jari menekuk"],
    mechanism: "Benturan pada ujung jari yang sedang lurus (biasanya bola) memutus atau melepas tendon pelurus ujung jari, sehingga ujung jari tidak bisa diluruskan.",
  },
  // ---------- Panggul & paha ----------
  {
    name: "Greater Trochanteric Pain Syndrome",
    region: "Panggul",
    keywords: ["trochanteric", "gtps", "bursitis trokanter", "trochanteric bursitis", "gluteal tendinopathy", "nyeri pinggul samping", "nyeri panggul samping"],
    mechanism: "Otot gluteus medius yang lemah, tidur miring pada sisi yang sakit, berdiri bertumpu satu kaki, atau lari membebani tendon dan bursa di sisi luar pinggul hingga nyeri.",
  },
  {
    name: "Hip Labral Tear / FAI",
    region: "Panggul",
    keywords: ["fai", "femoroacetabular", "hip impingement", "labral tear", "labrum panggul", "robek labrum panggul", "panggul terjepit"],
    mechanism: "Bentuk tulang panggul atau kepala paha yang kurang pas, ditambah gerakan menekuk dan memutar panggul dalam berulang (olahraga, jongkok), menjepit dan merobek bibir sendi (labrum) panggul.",
  },
  {
    name: "Hip Flexor Strain",
    region: "Panggul",
    keywords: ["hip flexor", "iliopsoas", "otot lipat paha", "lipat paha depan"],
    mechanism: "Sprint, menendang, atau mengangkat lutut dengan kuat secara mendadak meregangkan otot penekuk panggul (iliopsoas) melebihi batasnya.",
  },
  {
    name: "Meralgia Paresthetica",
    region: "Paha",
    keywords: ["meralgia", "meralgia paresthetica", "kesemutan paha luar", "baal paha luar", "paha luar kebas"],
    mechanism: "Saraf kulit paha luar tertekan di pangkal paha oleh ikat pinggang atau celana yang ketat, berat badan berlebih, atau kehamilan, sehingga paha luar kesemutan atau baal.",
  },
  {
    name: "Post-Operative Hip Replacement",
    region: "Pasca operasi",
    keywords: ["thr", "tha", "hip replacement", "ganti panggul", "ganti sendi panggul", "pasca operasi panggul", "hemiarthroplasty"],
    mechanism: "Penggantian sendi panggul karena patah leher tulang paha atau kerusakan sendi berat; setelah operasi jalan perlu alat bantu, otot panggul lemah, dan ada posisi yang harus dihindari.",
  },
  // ---------- Lutut ----------
  {
    name: "PCL Injury",
    region: "Lutut",
    keywords: ["pcl", "posterior cruciate", "ligamen belakang lutut"],
    mechanism: "Lutut yang menekuk terbentur dari depan (dasbor saat kecelakaan) atau jatuh bertumpu pada lutut menekuk mendorong tulang kering ke belakang dan merobek ligamen PCL.",
  },
  {
    name: "LCL Sprain",
    region: "Lutut",
    keywords: ["lcl", "lateral collateral", "ligamen luar lutut"],
    mechanism: "Benturan pada sisi dalam lutut yang mendorong lutut ke arah luar meregangkan hingga merobek ligamen kolateral lateral.",
  },
  {
    name: "IT Band Syndrome",
    region: "Lutut",
    keywords: ["it band", "itbs", "iliotibial", "nyeri lutut luar", "lutut sisi luar"],
    mechanism: "Gerakan menekuk-meluruskan lutut berulang saat lari atau bersepeda, terutama dengan otot pinggul yang lemah, membuat pita iliotibial bergesekan di sisi luar lutut hingga nyeri.",
  },
  {
    name: "Pes Anserine Bursitis",
    region: "Lutut",
    keywords: ["pes anserine", "pes anserinus", "bursitis pes anserine", "nyeri lutut dalam bawah"],
    mechanism: "Berat badan berlebih, OA lutut, lari, atau otot hamstring yang tegang mengiritasi bursa di sisi dalam lutut, sedikit di bawah sendi.",
  },
  {
    name: "Prepatellar Bursitis",
    region: "Lutut",
    keywords: ["prepatellar", "bursitis lutut", "lutut bengkak depan", "housemaid's knee"],
    mechanism: "Berlutut lama dan berulang (mengepel, beribadah, bekerja) atau benturan pada tempurung lutut mengiritasi bursa di depan lutut hingga bengkak.",
  },
  {
    name: "Baker's Cyst",
    region: "Lutut",
    keywords: ["baker's cyst", "bakers cyst", "kista baker", "kista poplitea", "benjolan belakang lutut"],
    mechanism: "Cairan sendi lutut yang berlebih akibat OA atau robekan meniskus terdorong ke belakang lutut dan membentuk kantung, sehingga belakang lutut terasa penuh dan kaku saat menekuk.",
  },
  {
    name: "Patellar Dislocation",
    region: "Lutut",
    keywords: ["patellar dislocation", "dislokasi patella", "tempurung lutut bergeser", "patella lepas", "tempurung lutut lepas"],
    mechanism: "Memutar badan dengan kaki menapak (olahraga, menari) membuat tempurung lutut bergeser ke luar dan merobek penahannya di sisi dalam.",
  },
  {
    name: "Osgood-Schlatter",
    region: "Lutut",
    keywords: ["osgood", "osgood schlatter", "benjolan bawah lutut"],
    mechanism: "Pada anak dan remaja yang sedang tumbuh, tarikan berulang tendon patella saat melompat dan berlari mengiritasi lempeng pertumbuhan di bawah lutut hingga nyeri dan menonjol.",
  },
  {
    name: "Post-Arthroscopy Knee",
    region: "Pasca operasi",
    keywords: ["arthroscopy", "artroskopi", "pasca artroskopi", "menisektomi", "meniscectomy", "operasi meniskus"],
    mechanism: "Tindakan artroskopi untuk meniskus atau tulang rawan lutut; setelah operasi lutut bengkak, gerak terbatas, dan otot paha depan lemah.",
  },
  // ---------- Pergelangan kaki & kaki ----------
  {
    name: "Achilles Tendon Rupture",
    region: "Pergelangan kaki",
    keywords: ["achilles rupture", "ruptur achilles", "tendon achilles putus", "putus tendon achilles", "achilles putus"],
    mechanism: "Tolakan kaki mendadak dan kuat (meloncat, sprint, lari ke depan saat bermain) pada tendon yang sudah lelah atau menipis memutus tendon Achilles; terasa seperti ditendang dari belakang.",
  },
  {
    name: "Ankle Fracture",
    region: "Pergelangan kaki",
    keywords: ["ankle fracture", "fraktur ankle", "fraktur malleolus", "patah pergelangan kaki", "bimalleolar", "trimalleolar"],
    mechanism: "Pergelangan kaki terpuntir keras saat jatuh atau terpeleset mematahkan ujung tulang kering atau betis (malleolus); setelah gips atau operasi pergelangan kaku dan jalan belum stabil.",
  },
  {
    name: "Chronic Ankle Instability",
    region: "Pergelangan kaki",
    keywords: ["ankle instability", "chronic ankle instability", "sering terkilir", "sering keseleo", "pergelangan kaki goyang"],
    mechanism: "Terkilir berulang yang dulu tidak dilatih sampai pulih membuat ligamen pergelangan kaki longgar dan keseimbangan berkurang, sehingga mudah terkilir lagi.",
  },
  {
    name: "Flat Foot",
    region: "Kaki",
    keywords: ["flat foot", "flatfoot", "pes planus", "kaki datar", "telapak kaki rata", "telapak kaki datar"],
    mechanism: "Lengkung telapak kaki rendah sejak kecil atau melemah karena otot tibialis posterior lemah, berat badan berlebih, dan berdiri lama, sehingga kaki, lutut, atau pinggang cepat lelah dan nyeri.",
  },
  {
    name: "Hallux Valgus",
    region: "Kaki",
    keywords: ["hallux valgus", "bunion", "jempol kaki bengkok", "benjolan jempol kaki"],
    mechanism: "Sepatu sempit dan runcing atau berhak tinggi, ditambah faktor keturunan, mendorong jempol kaki miring ke arah jari lain sehingga pangkalnya menonjol dan nyeri.",
  },
  {
    name: "Morton's Neuroma",
    region: "Kaki",
    keywords: ["morton", "morton's neuroma", "neuroma", "nyeri sela jari kaki", "kesemutan jari kaki"],
    mechanism: "Sepatu sempit atau berhak tinggi menjepit saraf di antara tulang telapak kaki depan (biasanya antara jari 3 dan 4) hingga menebal, terasa seperti menginjak kerikil.",
  },
  {
    name: "Metatarsalgia",
    region: "Kaki",
    keywords: ["metatarsalgia", "nyeri telapak kaki depan", "nyeri bola kaki"],
    mechanism: "Sepatu berhak tinggi, lari atau melompat berulang, dan lengkung kaki yang tinggi membebani telapak kaki depan sehingga nyeri saat menapak.",
  },
  {
    name: "Stress Fracture",
    region: "Tungkai bawah",
    keywords: ["stress fracture", "fraktur stres", "retak tulang lari", "retak tulang kering"],
    mechanism: "Beban latihan yang naik terlalu cepat (lari, baris-berbaris) tanpa cukup istirahat membuat tulang retak kecil karena tidak sempat memperbaiki diri.",
  },
  {
    name: "Sever's Disease",
    region: "Kaki",
    keywords: ["sever", "sever's disease", "nyeri tumit anak"],
    mechanism: "Pada anak yang sedang tumbuh dan aktif berolahraga, tarikan tendon Achilles berulang mengiritasi lempeng pertumbuhan tulang tumit.",
  },
  // ---------- Otot & sendi umum ----------
  {
    name: "Muscle Fatigue / DOMS",
    region: "Otot",
    keywords: ["doms", "pegal linu", "badan pegal", "otot pegal", "pegal setelah olahraga", "nyeri otot setelah latihan", "kelelahan otot"],
    mechanism: "Aktivitas atau latihan yang tidak biasa atau terlalu berat menimbulkan kerusakan kecil dan penumpukan ketegangan pada otot, sehingga pegal dan kaku 1–3 hari setelahnya.",
  },
  {
    name: "Fibromyalgia",
    region: "Otot",
    keywords: ["fibromyalgia", "fibromialgia", "nyeri seluruh badan", "nyeri di mana mana"],
    mechanism: "Sistem saraf yang terlalu peka terhadap nyeri, bukan karena cedera, sering dipicu stres, kurang tidur, atau sakit berkepanjangan; nyeri menyebar disertai lelah.",
  },
  {
    name: "Rheumatoid Arthritis",
    region: "Sendi",
    keywords: ["rheumatoid", "rheumatoid arthritis", "artritis reumatoid", "rematik", "rematoid"],
    mechanism: "Peradangan autoimun pada lapisan sendi, bukan karena cedera, umumnya pada sendi kecil tangan dan kaki di kedua sisi; sendi bengkak dan kaku terutama pagi hari.",
  },
  {
    name: "Gout Arthritis",
    region: "Sendi",
    keywords: ["gout", "asam urat", "pirai", "artritis gout"],
    mechanism: "Kristal asam urat mengendap di sendi (sering pangkal jempol kaki, pergelangan kaki, lutut), dipicu makanan tinggi purin, alkohol, atau kurang minum, sehingga sendi mendadak merah, bengkak, dan sangat nyeri.",
  },
  {
    name: "Osteoporosis",
    region: "Sendi",
    keywords: ["osteoporosis", "osteopenia", "keropos tulang", "tulang keropos"],
    mechanism: "Kepadatan tulang berkurang karena usia, menopause, kurang gerak, atau obat tertentu, sehingga tulang mudah retak pada jatuh ringan; latihan beban dan keseimbangan membantu mencegahnya.",
  },
  // ---------- Neurologi ----------
  {
    name: "Parkinson's Disease",
    region: "Neurologi",
    keywords: ["parkinson", "parkinsonism", "tremor", "gemetar", "jalan diseret"],
    mechanism: "Berkurangnya sel saraf penghasil dopamin di otak secara bertahap, bukan karena cedera, menimbulkan gemetar, kaku, gerak melambat, dan keseimbangan menurun sehingga mudah jatuh.",
  },
  {
    name: "Spinal Cord Injury",
    region: "Neurologi",
    keywords: ["spinal cord injury", "sci", "cedera saraf tulang belakang", "cedera medula spinalis", "paraplegia", "tetraplegia", "lumpuh kedua kaki"],
    mechanism: "Cedera sumsum tulang belakang karena jatuh, kecelakaan, atau penyakit memutus sebagian atau seluruh jalur saraf, sehingga gerak dan rasa di bawah tingkat cedera lemah atau hilang.",
  },
  {
    name: "Peripheral Neuropathy",
    region: "Neurologi",
    keywords: ["neuropathy", "neuropati", "neuropati diabetik", "diabetic neuropathy", "kaki kebas", "kaki kesemutan", "baal kaki", "kaki baal"],
    mechanism: "Kerusakan saraf tepi, paling sering karena gula darah tinggi lama (diabetes), kekurangan vitamin B12, atau alkohol, sehingga kaki dan tangan kesemutan, baal, dan keseimbangan menurun.",
  },
  {
    name: "Guillain-Barré Syndrome",
    region: "Neurologi",
    keywords: ["guillain", "guillain barre", "gbs"],
    mechanism: "Sistem imun menyerang saraf tepi, biasanya setelah infeksi, sehingga lemah naik dari kaki ke atas dalam beberapa hari; pemulihan bertahap dengan latihan.",
  },
  {
    name: "Vertigo (BPPV)",
    region: "Neurologi",
    keywords: ["vertigo", "bppv", "pusing berputar", "kepala berputar", "dunia berputar"],
    mechanism: "Kristal kecil di telinga dalam lepas dan masuk ke saluran keseimbangan, sering setelah benturan kepala atau tanpa sebab jelas, sehingga pusing berputar sesaat ketika posisi kepala berubah.",
  },
  {
    name: "Head Injury",
    region: "Neurologi",
    keywords: ["head injury", "cedera kepala", "tbi", "traumatic brain injury", "pasca kraniotomi", "craniotomy", "kraniotomi"],
    mechanism: "Benturan keras pada kepala (kecelakaan, jatuh) atau operasi otak mengganggu fungsi otak, sehingga gerak, keseimbangan, dan konsentrasi perlu dilatih kembali.",
  },
  {
    name: "Radial Nerve Palsy",
    region: "Neurologi",
    keywords: ["radial nerve palsy", "radial palsy", "wrist drop", "drop hand", "saturday night palsy", "tangan lunglai", "pergelangan tangan lunglai"],
    mechanism: "Saraf radialis di lengan atas tertekan (tidur bertumpu pada lengan, lengan menggantung di sandaran kursi) atau cedera karena patah tulang lengan atas, sehingga pergelangan dan jari tidak bisa diangkat.",
  },
  {
    name: "Foot Drop",
    region: "Neurologi",
    keywords: ["foot drop", "drop foot", "peroneal palsy", "kaki lunglai", "kaki menyeret", "ujung kaki tidak bisa diangkat"],
    mechanism: "Saraf peroneus di bawah lutut sisi luar tertekan (duduk menyilangkan kaki lama, gips, berat badan turun drastis) atau akar saraf L5 terjepit, sehingga ujung kaki tidak bisa diangkat dan jalan menyeret.",
  },
  {
    name: "Brachial Plexus Injury",
    region: "Neurologi",
    keywords: ["brachial plexus", "plexus brachialis", "pleksus brakialis", "erb's palsy", "erb palsy", "erb", "lengan bayi lemah"],
    mechanism: "Tarikan keras antara leher dan bahu meregangkan atau merobek anyaman saraf lengan: pada bayi saat persalinan sulit (bahu tersangkut), pada dewasa karena jatuh dari motor.",
  },
  // ---------- Anak ----------
  {
    name: "Cerebral Palsy",
    region: "Anak",
    keywords: ["cerebral palsy", "palsi serebral", "cp spastik", "cp diplegi"],
    mechanism: "Gangguan perkembangan otak sebelum, saat, atau segera setelah lahir (lahir prematur, kurang oksigen, infeksi) yang memengaruhi tonus otot, gerak, dan keseimbangan; bukan penyakit yang memburuk.",
  },
  {
    name: "Developmental Delay",
    region: "Anak",
    keywords: ["developmental delay", "global developmental delay", "gdd", "keterlambatan motorik", "telat jalan", "terlambat jalan", "belum bisa jalan", "terlambat duduk", "hipotonia", "hypotonia", "otot lembek"],
    mechanism: "Kemampuan motorik anak (tengkurap, duduk, berdiri, berjalan) belum sesuai usia, misalnya karena lahir prematur, tonus otot rendah, atau gangguan saraf.",
  },
  {
    name: "Down Syndrome",
    region: "Anak",
    keywords: ["down syndrome", "sindrom down", "trisomi 21"],
    mechanism: "Kelainan kromosom 21 yang membuat tonus otot rendah dan sendi lentur, sehingga perkembangan motorik lebih lambat dan perlu dilatih bertahap.",
  },
  {
    name: "CTEV (Clubfoot)",
    region: "Anak",
    keywords: ["ctev", "clubfoot", "club foot", "kaki pengkor", "talipes"],
    mechanism: "Kelainan bawaan sejak dalam kandungan, kaki bayi menekuk ke dalam dan ke bawah; ditangani dengan gips bertahap (Ponseti), brace, dan latihan peregangan.",
  },
  // ---------- Kebidanan, kardio-respirasi, lainnya ----------
  {
    name: "Diastasis Recti",
    region: "Perut",
    keywords: ["diastasis recti", "diastasis", "perut renggang", "otot perut terpisah", "otot perut renggang"],
    mechanism: "Kehamilan meregangkan jaringan di garis tengah perut sehingga dua sisi otot perut lurus merenggang; setelah melahirkan perut menonjol dan punggung mudah nyeri.",
  },
  {
    name: "Pregnancy Pelvic Girdle Pain",
    region: "Panggul",
    keywords: ["pelvic girdle pain", "nyeri panggul hamil", "nyeri panggul saat hamil", "symphysis pubis", "spd", "nyeri tulang kemaluan"],
    mechanism: "Hormon kehamilan melonggarkan ligamen panggul, ditambah berat badan dan perubahan postur, sehingga sendi panggul depan dan belakang nyeri saat berjalan, naik tangga, atau membalik badan.",
  },
  {
    name: "Postpartum Rehabilitation",
    region: "Perut",
    keywords: ["pasca melahirkan", "postpartum", "post partum", "nifas", "pasca sesar", "pasca sc", "post sc"],
    mechanism: "Kehamilan dan persalinan (normal atau sesar) meregangkan dan melemahkan otot perut dan dasar panggul, sehingga punggung mudah pegal dan perlu latihan pemulihan bertahap.",
  },
  {
    name: "Pelvic Floor Dysfunction",
    region: "Perut",
    keywords: ["pelvic floor", "dasar panggul", "otot dasar panggul", "inkontinensia", "incontinence", "beser", "ngompol"],
    mechanism: "Otot dasar panggul melemah karena persalinan, usia, batuk kronis, atau sering mengejan, sehingga sulit menahan buang air kecil saat batuk, bersin, atau mengangkat beban.",
  },
  {
    name: "Lymphedema",
    region: "Lainnya",
    keywords: ["lymphedema", "limfedema", "lengan bengkak", "pasca mastektomi", "mastectomy"],
    mechanism: "Pengangkatan atau penyinaran kelenjar getah bening (misalnya pada kanker payudara) menghambat aliran cairan getah bening sehingga lengan atau tungkai membengkak.",
  },
  {
    name: "COPD / Chronic Lung Disease",
    region: "Kardiorespirasi",
    keywords: ["ppok", "copd", "paru obstruktif", "bronkitis kronis", "emfisema", "sesak napas"],
    mechanism: "Merokok lama atau paparan polusi merusak saluran napas dan paru secara bertahap, sehingga mudah sesak saat beraktivitas dan dahak sulit dikeluarkan.",
  },
  {
    name: "Post-COVID / Deconditioning",
    region: "Kardiorespirasi",
    keywords: ["pasca covid", "post covid", "long covid", "deconditioning", "lemas setelah dirawat", "pasca rawat inap", "tirah baring lama"],
    mechanism: "Infeksi berat atau rawat inap dan tirah baring yang lama membuat otot mengecil, daya tahan jantung-paru turun, dan mudah lelah atau sesak saat beraktivitas.",
  },
  // ---------- Nyeri per area (umum): when no specific diagnosis is written yet ----------
  {
    name: "Knee Pain",
    region: "Lutut",
    general: true,
    keywords: ["knee pain", "nyeri lutut", "sakit lutut", "lutut sakit", "lutut nyeri", "ngilu lutut", "lutut ngilu", "linu lutut", "lutut linu", "nyeri sendi lutut", "lutut tidak nyaman", "cedera lutut", "knee injury"],
    mechanism:
      "Beban berulang pada lutut (naik-turun tangga, jongkok, berlari, melompat), salah tumpu atau lutut terpelintir saat berolahraga, kelemahan otot paha dan pinggul, atau berat badan berlebih membuat jaringan di sekitar sendi lutut teriritasi dan nyeri.",
  },
  {
    name: "Shoulder Pain",
    region: "Bahu",
    general: true,
    keywords: ["shoulder pain", "nyeri bahu", "sakit bahu", "bahu sakit", "bahu nyeri", "ngilu bahu", "nyeri sendi bahu", "nyeri pundak", "sakit pundak", "cedera bahu", "shoulder injury"],
    mechanism:
      "Gerakan mengangkat lengan berulang atau di atas kepala, mengangkat dan membawa beban, tidur bertumpu pada satu bahu, postur bahu membungkuk ke depan, atau jatuh bertumpu pada tangan membuat jaringan di sekitar sendi bahu teriritasi dan nyeri.",
  },
  {
    name: "Hip Pain",
    region: "Panggul",
    general: true,
    keywords: ["hip pain", "nyeri pinggul", "sakit pinggul", "pinggul sakit", "pinggul nyeri", "ngilu pinggul", "nyeri sendi pinggul", "nyeri panggul", "sakit panggul", "cedera pinggul"],
    mechanism:
      "Duduk lama, berjalan atau berlari jauh, tidur miring bertumpu pada satu sisi, kelemahan otot bokong, atau proses degenerasi membuat sendi pinggul dan jaringan di sekitarnya teriritasi dan nyeri.",
  },
  {
    name: "Ankle Pain",
    region: "Pergelangan kaki",
    general: true,
    keywords: ["ankle pain", "nyeri ankle", "sakit ankle", "ankle sakit", "nyeri pergelangan kaki", "sakit pergelangan kaki", "pergelangan kaki sakit", "nyeri mata kaki", "sakit mata kaki", "ankle tidak nyaman", "cedera ankle", "cedera pergelangan kaki"],
    mechanism:
      "Salah tumpu atau kaki terpelintir saat berjalan di permukaan tidak rata dan berolahraga, beban berulang saat berlari dan melompat, alas kaki yang kurang menopang, atau sisa cedera lama membuat jaringan di sekitar pergelangan kaki teriritasi dan nyeri.",
  },
  {
    name: "Foot Pain",
    region: "Kaki",
    general: true,
    keywords: ["foot pain", "nyeri kaki", "sakit kaki", "kaki sakit", "nyeri telapak kaki", "sakit telapak kaki", "telapak kaki sakit", "nyeri punggung kaki", "kaki pegal"],
    mechanism:
      "Berdiri atau berjalan lama, alas kaki yang sempit atau kurang menopang, bentuk lengkung kaki yang terlalu datar atau tinggi, dan berat badan berlebih memberi beban berulang pada telapak dan punggung kaki sehingga nyeri.",
  },
  {
    name: "Elbow Pain",
    region: "Siku",
    general: true,
    keywords: ["elbow pain", "nyeri siku", "sakit siku", "siku sakit", "siku nyeri", "ngilu siku", "cedera siku"],
    mechanism:
      "Gerakan menggenggam, memutar, dan mengangkat berulang (pekerjaan tangan, olahraga raket, angkat beban) atau benturan dan jatuh bertumpu pada tangan membuat otot, tendon, atau sendi di sekitar siku teriritasi.",
  },
  {
    name: "Wrist Pain",
    region: "Pergelangan tangan",
    general: true,
    keywords: ["wrist pain", "nyeri pergelangan tangan", "sakit pergelangan tangan", "pergelangan tangan sakit", "cedera pergelangan tangan"],
    mechanism:
      "Gerakan pergelangan tangan berulang (mengetik, memakai ponsel, mengangkat bayi, memotong), bertumpu pada tangan, atau jatuh bertumpu pada telapak tangan membuat tendon, ligamen, atau sendi pergelangan tangan teriritasi.",
  },
  {
    name: "Hand & Finger Pain",
    region: "Tangan",
    general: true,
    keywords: ["hand pain", "finger pain", "nyeri tangan", "sakit tangan", "tangan sakit", "nyeri jari", "sakit jari", "jari sakit", "jari nyeri", "nyeri telapak tangan", "cedera jari"],
    mechanism:
      "Menggenggam, mencubit, atau mengetik berulang, jari terbentur atau tertekuk paksa, atau proses degenerasi membuat sendi, tendon, dan otot kecil di tangan dan jari teriritasi.",
  },
  {
    name: "Thigh Pain",
    region: "Paha",
    general: true,
    keywords: ["thigh pain", "nyeri paha", "sakit paha", "paha sakit", "paha nyeri", "paha pegal"],
    mechanism:
      "Otot paha tertarik saat berlari cepat, menendang, atau melompat, benturan langsung, atau beban latihan yang naik terlalu cepat membuat otot dan tendon paha nyeri; nyeri paha juga bisa menjalar dari pinggang atau pinggul.",
  },
  {
    name: "Calf & Lower Leg Pain",
    region: "Tungkai bawah",
    general: true,
    keywords: ["calf pain", "leg pain", "lower leg pain", "nyeri betis", "sakit betis", "betis sakit", "betis nyeri", "betis pegal", "nyeri tungkai", "sakit tungkai", "nyeri tungkai bawah"],
    mechanism:
      "Otot betis bekerja berlebihan saat berlari, berjalan jauh, atau berdiri lama, beban latihan yang naik terlalu cepat, atau otot jarang diregangkan membuat otot dan tendon tungkai bawah nyeri dan mudah kram.",
  },
  {
    name: "Chest Wall Pain / Costochondritis",
    region: "Dada",
    general: true,
    keywords: ["costochondritis", "kostokondritis", "chest wall pain", "nyeri dinding dada", "nyeri dada", "nyeri dada saat napas", "nyeri rusuk", "sakit rusuk", "nyeri tulang rusuk", "rib pain", "nyeri iga", "intercostal", "otot sela iga"],
    mechanism:
      "Batuk keras berulang, benturan pada dada, mengangkat beban sambil memutar badan, atau postur membungkuk lama membuat sambungan tulang rusuk dan otot di antaranya meradang; nyeri bertambah saat menarik napas dalam atau ditekan. Nyeri dada perlu dipastikan bukan dari jantung.",
  },
  {
    name: "Joint Pain (Arthralgia)",
    region: "Sendi",
    general: true,
    keywords: ["joint pain", "arthralgia", "artralgia", "nyeri sendi", "sakit sendi", "sendi sakit", "ngilu sendi",  "linu"],
    mechanism:
      "Beban berulang, kurang gerak, berat badan berlebih, perubahan cuaca, atau proses degenerasi dan peradangan membuat satu atau beberapa sendi terasa nyeri, ngilu, atau kaku.",
  },
  {
    name: "Muscle Strain",
    region: "Otot",
    general: true,
    keywords: ["muscle strain", "strain otot", "otot tertarik", "otot ketarik", "tarikan otot", "cedera otot", "pulled muscle", "otot robek"],
    mechanism:
      "Otot diregangkan atau dikontraksikan melebihi kemampuannya (gerakan mendadak, mengangkat beban, berolahraga tanpa pemanasan, atau saat otot lelah) sehingga serabut otot teregang atau robek sebagian.",
  },
  {
    name: "Contusion",
    region: "Otot",
    general: true,
    keywords: ["contusion", "kontusio", "memar", "lebam", "bruise", "terbentur", "kena benturan", "benturan langsung"],
    mechanism: "Benturan langsung pada otot atau tulang (tertendang, terjatuh, tertabrak) merusak pembuluh darah kecil sehingga timbul memar, bengkak, dan nyeri saat ditekan atau digerakkan.",
  },
  {
    name: "Muscle Cramp",
    region: "Otot",
    general: true,
    keywords: ["muscle cramp", "kram", "kram otot", "keram", "keram otot", "kejang otot", "kram betis"],
    mechanism: "Otot berkontraksi mendadak dan tidak bisa rileks, dipicu kelelahan, kurang cairan atau elektrolit, otot yang jarang diregangkan, atau posisi statis yang lama.",
  },
  {
    name: "Post-Operative Rehabilitation",
    region: "Pasca operasi",
    general: true,
    keywords: ["post operative", "post operasi", "post op", "pasca operasi", "setelah operasi", "habis operasi", "pasca bedah"],
    mechanism: "Operasi dan masa istirahat setelahnya membuat sendi kaku, otot melemah, dan daya tahan menurun, sehingga gerak, kekuatan, dan aktivitas perlu dipulihkan bertahap sesuai anjuran dokter bedah.",
  },
  {
    name: "Joint Stiffness after Immobilisation",
    region: "Sendi",
    general: true,
    keywords: ["joint stiffness", "kaku sendi", "sendi kaku", "pasca gips", "setelah gips", "lepas gips", "post cast", "kaku setelah gips", "kaku setelah bidai"],
    mechanism: "Sendi yang lama tidak digerakkan (gips, bidai, penyangga, atau tirah baring) membuat kapsul sendi dan otot di sekitarnya memendek dan melemah, sehingga gerak sendi terbatas dan nyeri saat mulai digerakkan.",
  },
  {
    name: "Osteoarthritis",
    region: "Sendi",
    general: true,
    keywords: ["osteoarthritis", "osteoartritis", "oa", "pengapuran", "pengapuran sendi", "sendi aus", "radang sendi degeneratif", "degenerative joint disease"],
    mechanism: "Tulang rawan sendi menipis dan aus seiring usia, beban berulang, berat badan berlebih, atau bekas cedera sendi, sehingga sendi nyeri saat dipakai, kaku di pagi hari, dan geraknya berkurang.",
  },
  {
    name: "Joint Hypermobility",
    region: "Sendi",
    keywords: ["hypermobility", "hipermobilitas", "joint hypermobility", "sendi terlalu lentur", "sendi lentur berlebih", "ehlers danlos"],
    mechanism: "Jaringan ikat yang lebih lentur dari biasanya (bawaan) membuat sendi bergerak melebihi batas normal, sehingga mudah terkilir, pegal, dan cepat lelah bila otot penyangganya lemah.",
  },
  // ---------- Lutut ----------
  {
    name: "Knee Sprain",
    region: "Lutut",
    keywords: ["knee sprain", "lutut terkilir", "lutut keseleo", "lutut terpelintir", "keseleo lutut", "terkilir lutut", "cedera ligamen lutut"],
    mechanism: "Lutut terpelintir atau tertekuk ke samping saat mendarat, berbalik arah mendadak, atau salah tumpu (misalnya saat bermain bola) meregangkan ligamen dan kapsul sendi lutut.",
  },
  {
    name: "Post-ACL Reconstruction",
    region: "Pasca operasi",
    keywords: ["acl reconstruction", "acl recon", "acl r", "aclr", "post acl", "pasca acl", "rekonstruksi acl", "operasi acl", "post op acl", "pasca operasi acl", "post operasi acl", "setelah operasi acl"],
    mechanism: "Ligamen ACL yang putus diganti cangkok tendon melalui operasi; lutut dipulihkan bertahap (gerak sendi, kekuatan otot paha, keseimbangan, latihan lari dan lompat) sebelum kembali berolahraga.",
  },
  {
    name: "Chondromalacia Patellae",
    region: "Lutut",
    keywords: ["chondromalacia", "chondromalacia patella", "chondromalacia patellae", "kondromalasia", "tulang rawan tempurung lutut"],
    mechanism: "Tulang rawan di balik tempurung lutut melunak dan aus karena tempurung bergerak tidak lurus, otot paha lemah, atau beban berulang saat jongkok, naik tangga, dan duduk lama dengan lutut menekuk.",
  },
  {
    name: "Plica Syndrome",
    region: "Lutut",
    keywords: ["plica", "plica syndrome", "sindrom plika", "medial plica"],
    mechanism: "Lipatan lapisan sendi lutut (plika) teriritasi dan menebal karena gerakan menekuk-meluruskan lutut berulang (bersepeda, berlari) atau benturan, sehingga nyeri dan terasa klik di lutut sisi dalam.",
  },
  {
    name: "Hoffa's Fat Pad Syndrome",
    region: "Lutut",
    keywords: ["hoffa", "hoffa's", "fat pad", "fat pad syndrome", "bantalan lemak lutut"],
    mechanism: "Bantalan lemak di bawah tempurung lutut terjepit saat lutut terlalu lurus (hiperekstensi) berulang atau terbentur langsung, sehingga meradang dan nyeri di bawah tempurung lutut.",
  },
  {
    name: "Quadriceps Tendinopathy",
    region: "Lutut",
    keywords: ["quadriceps tendinopathy", "quadriceps tendinitis", "tendinitis quadriceps", "nyeri di atas tempurung lutut"],
    mechanism: "Beban berulang pada tendon otot paha depan saat melompat, jongkok dengan beban, atau naik-turun tangga membuat tendon di atas tempurung lutut teriritasi.",
  },
  {
    name: "Genu Valgum / Varum",
    region: "Lutut",
    keywords: ["genu valgum", "genu varum", "kaki x", "kaki o", "lutut x", "lutut o", "bow legs", "bow leg", "knock knees", "knock knee"],
    mechanism: "Tungkai bengkok ke dalam (X) atau ke luar (O), bisa bagian dari perkembangan anak, atau karena otot lemah, berat badan berlebih, atau pengapuran lutut pada dewasa, sehingga beban sendi lutut tidak merata.",
  },
  // ---------- Pergelangan kaki & kaki ----------
  {
    name: "High Ankle Sprain",
    region: "Pergelangan kaki",
    keywords: ["high ankle sprain", "syndesmosis", "syndesmotic sprain", "sindesmosis", "cedera syndesmosis"],
    mechanism: "Kaki terputar keluar dengan kuat saat menapak (olahraga kontak, mendarat salah) meregangkan ligamen yang mengikat tulang kering dan tulang betis tepat di atas mata kaki.",
  },
  {
    name: "Peroneal Tendinopathy",
    region: "Pergelangan kaki",
    keywords: ["peroneal tendinopathy", "peroneal tendinitis", "tendinitis peroneus", "nyeri mata kaki luar"],
    mechanism: "Beban berulang saat berlari di permukaan miring, keseleo berulang, atau kaki yang cenderung miring ke luar membuat tendon peroneus di belakang mata kaki luar teriritasi.",
  },
  {
    name: "Posterior Tibial Tendon Dysfunction",
    region: "Pergelangan kaki",
    keywords: ["posterior tibial tendon", "pttd", "tibialis posterior", "tendinitis tibialis posterior", "nyeri mata kaki dalam"],
    mechanism: "Tendon tibialis posterior yang menopang lengkung kaki melemah dan teriritasi karena beban berulang, berat badan berlebih, atau usia, sehingga lengkung kaki makin turun dan mata kaki dalam nyeri.",
  },
  {
    name: "Tarsal Tunnel Syndrome",
    region: "Kaki",
    keywords: ["tarsal tunnel", "tarsal tunnel syndrome", "sindrom terowongan tarsal", "kesemutan telapak kaki", "telapak kaki kebas"],
    mechanism: "Saraf tibialis tertekan di terowongan sisi dalam mata kaki karena kaki datar, bengkak, bekas keseleo, atau sepatu sempit, sehingga telapak kaki kesemutan, panas, atau nyeri.",
  },
  {
    name: "Ankle Impingement",
    region: "Pergelangan kaki",
    keywords: ["ankle impingement", "anterior impingement", "posterior impingement", "jepitan pergelangan kaki"],
    mechanism: "Jaringan lunak atau taji tulang terjepit di depan atau belakang sendi pergelangan kaki saat menekuk penuh, sering setelah keseleo berulang atau pada penari dan pesepak bola.",
  },
  {
    name: "Hallux Rigidus",
    region: "Kaki",
    keywords: ["hallux rigidus", "jempol kaki kaku", "pengapuran jempol kaki", "big toe arthritis"],
    mechanism: "Sendi pangkal jempol kaki mengalami pengapuran karena beban berulang saat menolak (berjalan, berlari, berjinjit) atau bekas cedera, sehingga jempol kaku dan nyeri saat menekuk ke atas.",
  },
  {
    name: "Turf Toe",
    region: "Kaki",
    keywords: ["turf toe", "jempol kaki terkilir", "cedera jempol kaki"],
    mechanism: "Jempol kaki tertekuk ke atas secara berlebihan saat menolak di permukaan keras atau rumput sintetis, meregangkan kapsul dan ligamen di pangkal jempol.",
  },
  {
    name: "Post-Operative Ankle",
    region: "Pasca operasi",
    keywords: ["post op ankle", "pasca operasi ankle", "pasca operasi pergelangan kaki", "operasi pergelangan kaki", "orif ankle", "ankle orif"],
    mechanism: "Operasi pada pergelangan kaki (pen pada patah tulang, perbaikan ligamen atau tendon) disertai masa tanpa tumpuan membuat sendi kaku, otot betis melemah, dan keseimbangan berkurang.",
  },
  // ---------- Panggul & paha ----------
  {
    name: "Snapping Hip",
    region: "Panggul",
    keywords: ["snapping hip", "coxa saltans", "pinggul berbunyi", "bunyi klik pinggul", "pinggul klik"],
    mechanism: "Tendon atau pita jaringan di sekitar pinggul tergelincir melewati tonjolan tulang saat pinggul bergerak, karena otot yang tegang atau gerakan berulang (menari, berlari), sehingga terasa atau terdengar klik.",
  },
  {
    name: "Hip Fracture",
    region: "Panggul",
    keywords: ["hip fracture", "fraktur collum femur", "fraktur kolum femur", "patah tulang pinggul", "fraktur pinggul", "fraktur femur proksimal", "fraktur intertrochanter"],
    mechanism: "Jatuh dari posisi berdiri pada lansia dengan tulang keropos, atau benturan keras pada usia muda, mematahkan pangkal tulang paha; setelah operasi perlu latihan menumpu, berjalan, dan kekuatan bertahap.",
  },
  {
    name: "Avascular Necrosis of the Hip",
    region: "Panggul",
    keywords: ["avascular necrosis", "avn", "nekrosis avaskular", "osteonecrosis", "osteonekrosis", "avn femur"],
    mechanism: "Aliran darah ke kepala tulang paha terganggu (steroid jangka panjang, alkohol, bekas patah tulang), sehingga tulang melemah dan perlahan kolaps; pinggul nyeri saat menumpu dan berjalan.",
  },
  {
    name: "Proximal Hamstring Tendinopathy",
    region: "Paha",
    keywords: ["proximal hamstring tendinopathy", "hamstring tendinopathy", "tendinitis hamstring", "nyeri tulang duduk", "nyeri pangkal hamstring"],
    mechanism: "Beban berulang pada pangkal otot hamstring di tulang duduk (lari menanjak, sprint, duduk lama di permukaan keras) membuat tendonnya teriritasi dan nyeri saat duduk atau berlari.",
  },
  // ---------- Bahu ----------
  {
    name: "Shoulder Instability",
    region: "Bahu",
    keywords: ["shoulder instability", "bahu tidak stabil", "bahu sering lepas", "bahu longgar", "bankart", "shoulder subluxation", "subluksasi bahu"],
    mechanism: "Bahu pernah lepas sendi, atau ligamennya longgar (bawaan atau gerakan berulang di atas kepala seperti renang dan voli), sehingga sendi mudah bergeser saat lengan diangkat dan diputar.",
  },
  {
    name: "Proximal Humerus Fracture",
    region: "Bahu",
    keywords: ["proximal humerus fracture", "fraktur humerus", "fraktur humerus proksimal", "patah tulang lengan atas", "humerus fracture"],
    mechanism: "Jatuh bertumpu pada lengan atau langsung pada bahu, terutama pada lansia dengan tulang keropos, mematahkan pangkal tulang lengan atas; setelah imobilisasi bahu menjadi kaku dan lemah.",
  },
  {
    name: "Clavicle Fracture",
    region: "Bahu",
    keywords: ["clavicle fracture", "fraktur klavikula", "fraktur clavicula", "patah tulang selangka", "patah selangka"],
    mechanism: "Jatuh dengan bahu menghantam tanah atau bertumpu pada tangan yang terulur (bersepeda, motor, olahraga) mematahkan tulang selangka; setelah masa penyangga bahu perlu dilatih kembali.",
  },
  {
    name: "Biceps Tendon Rupture",
    region: "Bahu",
    keywords: ["biceps rupture", "biceps tendon rupture", "ruptur biceps", "tendon biceps putus", "popeye sign"],
    mechanism: "Mengangkat beban berat dengan siku menekuk secara mendadak, atau tendon yang sudah aus, membuat tendon otot biceps putus di bahu atau di siku.",
  },
  {
    name: "Winged Scapula",
    region: "Bahu",
    keywords: ["winged scapula", "scapular winging", "long thoracic nerve", "belikat menonjol", "tulang belikat menonjol"],
    mechanism: "Saraf yang menggerakkan otot serratus anterior tertekan atau teregang (membawa beban di bahu, gerakan berulang di atas kepala, operasi dada), sehingga tulang belikat menonjol ke belakang saat lengan mendorong.",
  },
  {
    name: "Pectoralis Strain",
    region: "Dada",
    keywords: ["pectoralis strain", "pectoral strain", "otot dada tertarik", "cedera otot dada", "nyeri otot dada"],
    mechanism: "Beban berlebih saat bench press, push-up, atau menahan jatuh membuat otot dada (pectoralis) tertarik atau robek sebagian.",
  },
  // ---------- Siku, pergelangan & tangan ----------
  {
    name: "Elbow Fracture / Dislocation",
    region: "Siku",
    keywords: ["elbow dislocation", "elbow fracture", "dislokasi siku", "siku lepas", "fraktur siku", "patah tulang siku", "post op siku", "fraktur olecranon"],
    mechanism: "Jatuh bertumpu pada tangan yang terulur membuat sendi siku bergeser atau tulang di sekitarnya patah; setelah imobilisasi siku sulit diluruskan dan ditekuk penuh.",
  },
  {
    name: "Scaphoid Fracture",
    region: "Pergelangan tangan",
    keywords: ["scaphoid fracture", "fraktur scaphoid", "fraktur skafoid", "patah tulang skafoid"],
    mechanism: "Jatuh bertumpu pada telapak tangan dengan pergelangan menekuk ke belakang mematahkan tulang skafoid di pangkal ibu jari; setelah gips pergelangan kaku dan genggaman lemah.",
  },
  {
    name: "Hand / Finger Fracture",
    region: "Tangan",
    keywords: ["hand fracture", "finger fracture", "boxer's fracture", "fraktur metakarpal", "fraktur metacarpal", "patah tulang tangan", "patah jari", "fraktur jari", "fraktur phalanx"],
    mechanism: "Meninju benda keras, tangan tertimpa, atau jari terbentur bola mematahkan tulang telapak tangan atau jari; setelah bidai atau operasi jari kaku dan genggaman lemah.",
  },
  {
    name: "Dupuytren's Contracture",
    region: "Tangan",
    keywords: ["dupuytren", "dupuytren's", "dupuytren's contracture", "kontraktur dupuytren", "jari tertarik ke telapak"],
    mechanism: "Jaringan ikat di telapak tangan menebal dan memendek perlahan (keturunan, diabetes, usia), sehingga jari manis dan kelingking tertarik menekuk dan sulit diluruskan.",
  },
  {
    name: "Thumb CMC Osteoarthritis",
    region: "Tangan",
    keywords: ["thumb arthritis", "cmc arthritis", "thumb cmc", "rhizarthrosis", "pengapuran ibu jari", "osteoartritis ibu jari", "nyeri pangkal ibu jari"],
    mechanism: "Sendi pangkal ibu jari aus karena usia dan beban berulang saat mencubit, memutar tutup botol, atau menggenggam, sehingga nyeri dan genggaman melemah.",
  },
  {
    name: "Skier's Thumb",
    region: "Tangan",
    keywords: ["skier's thumb", "gamekeeper's thumb", "ibu jari terkilir", "ibu jari keseleo", "ligamen ibu jari"],
    mechanism: "Ibu jari tertekuk paksa ke arah luar saat jatuh sambil memegang sesuatu (setang, tongkat) atau tertabrak bola, meregangkan atau merobek ligamen di pangkal ibu jari.",
  },
  {
    name: "Wrist Tendinitis",
    region: "Pergelangan tangan",
    keywords: ["wrist tendinitis", "wrist tendinopathy", "tendinitis pergelangan tangan", "radang tendon pergelangan tangan"],
    mechanism: "Gerakan pergelangan tangan berulang (mengetik, mengangkat bayi, memotong, olahraga raket) membuat tendon di sekitar pergelangan tangan meradang.",
  },
  {
    name: "Hand Tendon Repair",
    region: "Pasca operasi",
    keywords: ["tendon repair", "flexor tendon repair", "extensor tendon repair", "sambung tendon", "operasi tendon tangan", "pasca operasi tangan", "post op tangan"],
    mechanism: "Tendon tangan yang putus karena luka sayat atau cedera disambung melalui operasi; latihan gerak bertahap dengan bidai menjaga tendon tidak lengket dan tidak putus kembali.",
  },
  // ---------- Tulang belakang & dada ----------
  {
    name: "Thoracic Hyperkyphosis",
    region: "Punggung atas",
    keywords: ["kyphosis", "hyperkyphosis", "kifosis", "hiperkifosis", "bungkuk", "punggung bungkuk", "hunchback", "dowager's hump"],
    mechanism: "Kebiasaan duduk dan berdiri membungkuk, otot punggung yang lemah, pengeroposan tulang, atau usia membuat lengkung punggung atas berlebihan sehingga punggung dan leher mudah pegal.",
  },
  {
    name: "Hyperlordosis",
    region: "Punggung bawah",
    keywords: ["hyperlordosis", "hiperlordosis", "lordosis", "swayback", "pinggang terlalu melengkung"],
    mechanism: "Otot perut dan bokong yang lemah, otot depan pinggul yang tegang, perut besar atau kehamilan, dan sepatu hak tinggi membuat lengkung pinggang berlebihan sehingga sendi belakang tulang belakang tertekan.",
  },
  {
    name: "Spondylolysis",
    region: "Punggung bawah",
    keywords: ["spondylolysis", "spondilolisis", "pars defect", "pars interarticularis"],
    mechanism: "Gerakan menekuk ke belakang dan memutar badan berulang (senam, angkat beban, bulu tangkis, kriket) menimbulkan retak tekanan di bagian belakang ruas tulang pinggang, sering pada remaja yang aktif berolahraga.",
  },
  {
    name: "Degenerative Disc Disease",
    region: "Punggung bawah",
    keywords: ["degenerative disc disease", "degenerative disc", "ddd", "degenerasi diskus", "diskus aus", "dehidrasi diskus"],
    mechanism: "Bantalan antarruas tulang belakang kehilangan cairan dan menipis seiring usia, beban berulang, merokok, atau cedera lama, sehingga ruas kurang stabil dan mudah nyeri saat duduk atau membungkuk lama.",
  },
  {
    name: "Cervical Myelopathy",
    region: "Leher",
    keywords: ["cervical myelopathy", "myelopathy", "mielopati", "mielopati servikal", "tangan kikuk"],
    mechanism: "Penyempitan saluran tulang leher oleh pengapuran atau penonjolan diskus menekan sumsum tulang belakang, sehingga tangan kikuk dan kesemutan serta jalan tidak stabil yang memburuk perlahan.",
  },
  {
    name: "Rib Fracture",
    region: "Dada",
    keywords: ["rib fracture", "fraktur costae", "fraktur kosta", "fraktur iga", "patah tulang rusuk", "patah iga"],
    mechanism: "Benturan atau jatuh pada dada (kecelakaan, olahraga), atau batuk keras pada tulang keropos, mematahkan tulang rusuk sehingga nyeri saat bernapas dalam, batuk, dan bergerak.",
  },
  {
    name: "Abdominal Strain",
    region: "Perut",
    keywords: ["abdominal strain", "otot perut tertarik", "cedera otot perut", "nyeri otot perut"],
    mechanism: "Gerakan memutar badan mendadak, sit-up berlebihan, mengangkat beban, atau batuk keras membuat otot perut tertarik atau robek sebagian.",
  },
  // ---------- Neurologi & lansia ----------
  {
    name: "Multiple Sclerosis",
    region: "Neurologi",
    keywords: ["multiple sclerosis", "sklerosis multipel", "multipel sklerosis"],
    mechanism: "Sistem kekebalan menyerang selubung saraf di otak dan sumsum tulang belakang, sehingga timbul kelemahan, kaku, mudah lelah, dan gangguan keseimbangan yang kambuh-kambuhan.",
  },
  {
    name: "Balance Disorder / Fall Risk",
    region: "Lansia",
    keywords: ["balance disorder", "fall risk", "gangguan keseimbangan", "keseimbangan menurun", "mudah jatuh", "sering jatuh", "risiko jatuh", "jalan tidak stabil", "limbung"],
    mechanism: "Kekuatan otot tungkai, refleks keseimbangan, penglihatan, dan rasa posisi di kaki menurun (usia, penyakit saraf, obat-obatan, jarang bergerak), sehingga jalan tidak stabil dan mudah jatuh.",
  },
  {
    name: "Geriatric Weakness / Sarcopenia",
    region: "Lansia",
    keywords: ["sarcopenia", "sarkopenia", "geriatri", "geriatric", "lansia lemah", "kelemahan lansia", "otot mengecil", "frailty"],
    mechanism: "Massa dan kekuatan otot berkurang seiring usia, ditambah kurang aktivitas dan asupan protein, sehingga sulit bangkit dari kursi, naik tangga, dan mudah lelah.",
  },
  // ---------- Anak ----------
  {
    name: "Toe Walking",
    region: "Anak",
    keywords: ["toe walking", "jalan jinjit", "berjalan jinjit", "jalan berjinjit", "selalu jinjit"],
    mechanism: "Anak terbiasa berjalan dengan ujung kaki karena otot betis dan tendon Achilles pendek, kebiasaan, atau terkait gangguan saraf dan perkembangan, sehingga tumit jarang menapak.",
  },
  {
    name: "Autism Spectrum Disorder",
    region: "Anak",
    keywords: ["autism", "autisme", "autis", "asd", "spektrum autisme"],
    mechanism: "Gangguan perkembangan saraf yang memengaruhi komunikasi dan perilaku, sering disertai kesulitan koordinasi gerak, keseimbangan, dan pengolahan sensori yang perlu dilatih.",
  },
  {
    name: "Spina Bifida",
    region: "Anak",
    keywords: ["spina bifida", "myelomeningocele", "mielomeningokel"],
    mechanism: "Tulang belakang bayi tidak menutup sempurna sejak dalam kandungan sehingga saraf di bawahnya terganggu; kekuatan tungkai, berjalan, dan kontrol berkemih perlu dibantu.",
  },
  {
    name: "Developmental Dysplasia of the Hip",
    region: "Anak",
    keywords: ["ddh", "developmental dysplasia", "hip dysplasia", "displasia pinggul", "dislokasi pinggul bawaan"],
    mechanism: "Mangkuk sendi pinggul bayi terbentuk dangkal sejak lahir (posisi sungsang, riwayat keluarga, bedong terlalu kencang), sehingga kepala tulang paha mudah bergeser.",
  },
  // ---------- Kardiorespirasi & lainnya ----------
  {
    name: "Cardiac Rehabilitation",
    region: "Kardiorespirasi",
    keywords: ["cardiac rehab", "cardiac rehabilitation", "rehabilitasi jantung", "pasca serangan jantung", "post mi", "pasca pasang ring", "pasca cabg", "post cabg", "bypass jantung", "pasca operasi jantung", "gagal jantung", "heart failure"],
    mechanism: "Serangan jantung, pemasangan ring, operasi bypass, atau gagal jantung menurunkan daya tahan jantung; latihan bertahap yang terpantau mengembalikan kemampuan beraktivitas dengan aman.",
  },
  {
    name: "Asthma",
    region: "Kardiorespirasi",
    keywords: ["asthma", "asma", "mengi", "napas berbunyi"],
    mechanism: "Saluran napas yang sensitif menyempit dan berlendir saat terpicu alergen, debu, udara dingin, infeksi, atau olahraga berat, sehingga sesak dan napas berbunyi (mengi).",
  },
  {
    name: "Pneumonia / Sputum Retention",
    region: "Kardiorespirasi",
    keywords: ["pneumonia", "radang paru", "dahak sulit keluar", "dahak menumpuk", "fisioterapi dada", "chest physiotherapy", "bronkiektasis", "bronchiectasis"],
    mechanism: "Infeksi atau penyakit paru membuat dahak menumpuk di saluran napas dan sebagian paru tidak mengembang, sehingga perlu bantuan mengeluarkan dahak dan latihan napas.",
  },
  {
    name: "Amputation / Prosthetic Training",
    region: "Lainnya",
    keywords: ["amputation", "amputasi", "amputee", "prosthesis", "prostesis", "kaki palsu", "tangan palsu", "stump", "puntung"],
    mechanism: "Tungkai atau lengan diamputasi karena kecelakaan, diabetes, atau gangguan pembuluh darah; puntung perlu dirawat dan dibentuk, otot dikuatkan, dan pasien dilatih berjalan atau beraktivitas dengan prostesis.",
  },
  {
    name: "Burn Rehabilitation",
    region: "Lainnya",
    keywords: ["burn", "burns", "luka bakar", "kontraktur luka bakar", "parut luka bakar"],
    mechanism: "Luka bakar yang sembuh membentuk jaringan parut yang menarik kulit di atas sendi, sehingga gerak terbatas tanpa peregangan, pemakaian penyangga, dan latihan rutin.",
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    // Spine levels however written ("L4-L5", "L4/5", "l4l5", "L5 S1", "C5-6") read as "l4 l5".
    .replace(/\b([ctl]) ?(\d{1,2}) ?([ctls])? ?(\d{1,2})\b/g, (_m, a: string, x: string, b: string | undefined, y: string) => {
      const next = b ?? (a === "l" && x === "5" && y === "1" ? "s" : a);
      return `${a}${x} ${next}${y}`;
    })
    .trim();

/* Little words that sit inside a complaint but not inside a library phrase: "nyeri pada lutut", "sakit di bagian
   lutut" and "lutut yang nyeri" read as "nyeri lutut", "sakit lutut" and "lutut nyeri". */
const FILLER = new Set(["pada", "di", "bagian", "area", "daerah", "sebelah", "yang", "terasa"]);
const bare = (s: string) =>
  norm(s)
    .split(" ")
    .filter((w) => !FILLER.has(w))
    .join(" ");

/** The spine level named in a normalised complaint, as "L4-L5". */
function spineLevel(t: string) {
  const m = /\b([cl])(\d) ([cls])(\d)\b/.exec(t);
  return m ? `${m[1]}${m[2]}-${m[3]}${m[4]}`.toUpperCase() : null;
}

/** The case a complaint points to: the longest keyword (or name) found in it; a general case by body area only
 *  when no specific one is ("nyeri lutut, ACL" is the ACL injury, "nyeri lutut" alone is Knee Pain). */
export function matchCondition(text?: string | null): Condition | null {
  const t = ` ${bare(text ?? "")} `;
  if (t.trim().length < 3) return null;
  const longest = (general: boolean) => {
    let best: Condition | null = null;
    let len = 0;
    for (const c of CONDITIONS) {
      if (!!c.general !== general) continue;
      for (const k of [c.name, ...c.keywords]) {
        const n = bare(k);
        if (n.length > len && t.includes(` ${n} `)) {
          best = c;
          len = n.length;
        }
      }
    }
    return best;
  };
  const best = longest(false) ?? longest(true);
  // "HNP" or "disc bulging" with a level: the case for that level.
  const lv = best?.levels ? spineLevel(t) : null;
  const byLevel = lv ? best!.levels![lv] : null;
  return (byLevel && CONDITIONS.find((c) => c.name === byLevel)) || best;
}

/** Cases whose name or keywords contain what was typed, for the suggestions under the complaint. */
export function searchConditions(text: string, limit = 5): Condition[] {
  const q = bare(text);
  if (q.length < 2) return [];
  const words = q.split(" ").filter((w) => w.length >= 3);
  const scored = CONDITIONS.map((c) => {
    const hay = [c.name, ...c.keywords].map(bare);
    let score = 0;
    if (bare(c.name).startsWith(q)) score = 4;
    else if (hay.some((h) => h.startsWith(q))) score = 3;
    else if (hay.some((h) => h.includes(q) || q.includes(h))) score = 2;
    else if (words.length && words.some((w) => hay.some((h) => h.includes(w)))) score = 1;
    return { c, score };
  })
    .filter((x) => x.score > 0)
    // Ties: the general case first ("Knee Pain" before "Knee Osteoarthritis"), then shorter names.
    .sort((a, b) => b.score - a.score || +!!b.c.general - +!!a.c.general || a.c.name.length - b.c.name.length || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((x) => x.c);
}

/* Words that say nothing about which case it is: they are left out when suggesting from a free-text complaint. */
const PLAIN = new Set(
  (
    "nyeri sakit pain ngilu linu pegal rasa terasa merasa dirasakan saat ketika waktu setelah sesudah sebelum sejak akibat karena " +
    "sebab dan atau ada tidak tak nggak gak sedikit agak sangat sekali banget sering kadang masih sudah belum bisa dapat mau makin " +
    "semakin lebih kurang juga lalu kemudian dengan untuk dari ini itu hari minggu bulan tahun kanan kiri kedua pasien keluhan " +
    "mengeluh mengeluhkan nyaman jika bila kalau seperti mulai terus selalu tiba kambuh kaku bengkak susah sulit berat ringan " +
    "bangun tidur pagi siang sore malam the and with after since when left right patient complains"
  ).split(" "),
);

/* Each case's words, read once: from its name and keywords (strong), and from its mechanism of injury (weak). */
let WORDS: { c: Condition; phrases: string[]; named: Set<string>; story: Set<string> }[] | null = null;
function words() {
  return (WORDS ??= CONDITIONS.map((c) => {
    const phrases = [c.name, ...c.keywords].map(bare).filter((p) => p.length >= 3);
    return { c, phrases, named: new Set(phrases.flatMap((p) => p.split(" "))), story: new Set(bare(c.mechanism).split(" ")) };
  }));
}

/**
 * Cases a free-text complaint may be, best first: "Nyeri pada lutut akibat salah tumpu saat bermain bola, ankle tidak
 * nyaman" ranks knee and ankle cases, sprains above the rest. Whole phrases from the library count most, then single
 * words of a case's name and keywords ("lutut", "ankle"), then words of its usual mechanism ("tumpu", "bola").
 */
export function suggestConditions(text: string, limit = 5): Condition[] {
  const flat = bare(text);
  const t = ` ${flat} `;
  const toks = [...new Set(flat.split(" ").filter((w) => w.length >= 3 && !PLAIN.has(w) && !/^\d+$/.test(w)))];
  if (!toks.length) return [];
  const scored = words()
    .map(({ c, phrases, named, story }) => {
      let score = 0;
      for (const p of phrases) if (t.includes(` ${p} `)) score += 4 + p.split(" ").length;
      for (const w of toks) score += named.has(w) ? 2 : story.has(w) ? 0.75 : 0;
      return { c, score };
    })
    .filter((x) => x.score >= 2)
    // Ties: the general case, then the library's order (the common cases come first in it).
    .sort((a, b) => b.score - a.score || +!!b.c.general - +!!a.c.general || CONDITIONS.indexOf(a.c) - CONDITIONS.indexOf(b.c));
  return scored.slice(0, limit).map((x) => x.c);
}

/** Suggestions for what is typed under Keluhan: a word still being typed ("kne") by name, a sentence by its words. */
export function conditionIdeas(text: string, limit = 5): Condition[] {
  const n = bare(text).split(" ").filter(Boolean).length;
  const out: Condition[] = [];
  for (const c of [...suggestConditions(text, limit), ...(n <= 2 ? searchConditions(text, limit) : [])]) if (!out.includes(c)) out.push(c);
  return out.slice(0, limit);
}

export const conditionByName = (name?: string | null) => CONDITIONS.find((c) => c.name === name) ?? null;
