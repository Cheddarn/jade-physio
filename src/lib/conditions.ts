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
}

export const CONDITIONS: Condition[] = [
  // ---------- Leher ----------
  {
    name: "Cervical Pain",
    region: "Leher",
    keywords: ["cervical pain", "neck pain", "nyeri leher", "sakit leher", "leher kaku", "leher tegang", "tengeng", "salah bantal", "kaku leher"],
    mechanism:
      "Postur leher menunduk atau maju dalam waktu lama (gawai, laptop, menyetir), posisi tidur yang salah, atau stres membuat otot leher dan bahu atas tegang terus-menerus sehingga timbul spasme dan nyeri.",
  },
  {
    name: "Cervical Radiculopathy",
    region: "Leher",
    keywords: ["cervical radiculopathy", "radikulopati servikal", "saraf terjepit leher", "saraf kejepit leher", "hnp servikal", "nyeri leher menjalar", "kesemutan tangan", "pinched nerve neck"],
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
    keywords: ["trapezius", "myofascial", "myalgia", "pundak kaku", "pundak tegang", "bahu atas tegang", "trigger point"],
    mechanism:
      "Otot trapezius bekerja terus-menerus karena postur bahu terangkat, membawa tas berat di satu sisi, atau kerja depan komputer lama, sehingga terbentuk titik picu (trigger point) yang nyeri.",
  },
  // ---------- Bahu ----------
  {
    name: "Frozen Shoulder",
    region: "Bahu",
    keywords: ["frozen shoulder", "adhesive capsulitis", "bahu beku", "bahu kaku", "susah angkat tangan", "tidak bisa angkat tangan"],
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
    keywords: ["low back pain", "lbp", "nyeri punggung bawah", "nyeri pinggang", "sakit pinggang", "pinggang kaku", "encok", "boyok"],
    mechanism:
      "Mengangkat beban dengan punggung membungkuk, duduk lama dengan postur buruk, gerakan memutar mendadak, atau otot inti yang lemah membebani otot, ligamen, dan sendi punggung bawah sehingga timbul spasme dan nyeri.",
  },
  {
    name: "Lumbar Disc Herniation (HNP)",
    region: "Punggung bawah",
    keywords: ["hnp", "herniated disc", "disc herniation", "saraf kejepit", "saraf terjepit pinggang", "bantalan tulang", "slipped disc", "hernia nukleus pulposus"],
    mechanism:
      "Mengangkat beban sambil membungkuk dan memutar badan, atau degenerasi bantalan sendi tulang belakang, membuat inti bantalan (nukleus) menonjol keluar dan menekan akar saraf pinggang.",
  },
  {
    name: "Sciatica",
    region: "Punggung bawah",
    keywords: ["sciatica", "siatika", "skiatika", "nyeri menjalar ke kaki", "nyeri pantat ke kaki", "saraf sciatic"],
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
    keywords: ["postural", "postur buruk", "kifosis", "kyphosis", "bungkuk", "forward head", "upper crossed"],
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
    keywords: ["knee osteoarthritis", "oa genu", "oa lutut", "pengapuran lutut", "lutut nyeri naik tangga", "lutut bunyi", "osteoarthritis"],
    mechanism:
      "Degenerasi tulang rawan sendi lutut karena usia, berat badan berlebih, beban berulang, atau riwayat cedera lutut membuat sendi nyeri, kaku, dan kadang bengkak, terutama saat naik-turun tangga atau jongkok.",
  },
  {
    name: "ACL Injury",
    region: "Lutut",
    keywords: ["acl", "anterior cruciate", "ligamen lutut", "lutut goyang", "rekonstruksi acl", "post acl", "pasca acl"],
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
    keywords: ["patellofemoral", "pfps", "runner's knee", "nyeri tempurung lutut", "nyeri lutut depan", "chondromalacia"],
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
      "Kaki terpijak atau mendarat pada posisi telapak menghadap ke dalam (inversi), misalnya saat futsal, menuruni tangga, atau jalan di permukaan tidak rata, meregangkan hingga merobek ligamen sisi luar pergelangan kaki.",
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
    keywords: ["calf strain", "betis", "cedera betis", "tennis leg"],
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
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The case a complaint points to: the longest keyword (or name) found in it. */
export function matchCondition(text?: string | null): Condition | null {
  const t = ` ${norm(text ?? "")} `;
  if (t.trim().length < 3) return null;
  let best: Condition | null = null;
  let len = 0;
  for (const c of CONDITIONS) {
    for (const k of [c.name, ...c.keywords]) {
      const n = norm(k);
      if (n.length > len && t.includes(` ${n} `)) {
        best = c;
        len = n.length;
      }
    }
  }
  return best;
}

/** Cases whose name or keywords contain what was typed, for the suggestions under the complaint. */
export function searchConditions(text: string, limit = 5): Condition[] {
  const q = norm(text);
  if (q.length < 2) return [];
  const words = q.split(" ").filter((w) => w.length >= 3);
  const scored = CONDITIONS.map((c) => {
    const hay = [c.name, ...c.keywords].map(norm);
    let score = 0;
    if (norm(c.name).startsWith(q)) score = 4;
    else if (hay.some((h) => h.startsWith(q))) score = 3;
    else if (hay.some((h) => h.includes(q) || q.includes(h))) score = 2;
    else if (words.length && words.some((w) => hay.some((h) => h.includes(w)))) score = 1;
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((x) => x.c);
}

export const conditionByName = (name?: string | null) => CONDITIONS.find((c) => c.name === name) ?? null;
