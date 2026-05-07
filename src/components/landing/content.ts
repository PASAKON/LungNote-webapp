import type { Locale } from "@/i18n/config";

export type Testimonial = {
  text: string;
  initial: string;
  name: string;
  role: string;
};

export type FaqEntry = { q: string; a: string };

export type LandingContent = {
  nav: {
    features: string;
    how: string;
    reviews: string;
    faq: string;
    download: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleBefore: string;
    titleHighlight: string;
    titleAfter: string;
    subtitle: string;
    cta: string;
    notebookHeader: string;
    todos: { text: string; done: boolean }[];
    noteLine: string;
  };
  features: {
    label: string;
    titleLine1: string;
    titleLine2: string;
    desc: string;
    cards: { title: string; desc: string }[];
  };
  how: {
    label: string;
    title: string;
    desc: string;
    steps: { title: string; desc: string }[];
  };
  testimonials: {
    label: string;
    title: string;
    desc: string;
    items: Testimonial[];
  };
  download: {
    title: string;
    titleHighlight: string;
    desc: string;
    appStore: string;
    playStore: string;
    web: string;
    note: string;
  };
  faq: {
    label: string;
    title: string;
    items: FaqEntry[];
  };
  footer: {
    tagline: string;
    copyright: (year: number) => string;
    terms: string;
    privacy: string;
    contact: string;
  };
};

const th: LandingContent = {
  nav: {
    features: "จุดเด่น",
    how: "วิธีใช้",
    reviews: "รีวิว",
    faq: "คำถาม",
    download: "ดาวน์โหลด",
  },
  hero: {
    eyebrow: "Note-taking for students",
    titleLine1: "จดทุกอย่าง",
    titleBefore: "ด้วย",
    titleHighlight: "ลายมือ",
    titleAfter: "ของคุณ",
    subtitle:
      "โน้ต เช็คลิสต์ และไอเดีย — ทุกอย่างอยู่ในที่เดียว เรียบง่ายเหมือนเปิดสมุดโน้ตเล่มใหม่",
    cta: "เริ่มจดฟรี →",
    notebookHeader: "บันทึกของฉัน — วันนี้",
    todos: [
      { text: "อ่านบท 5 วิชาฟิสิกส์", done: true },
      { text: "ส่งรายงานกลุ่ม", done: true },
      { text: "ทบทวนศัพท์ภาษาอังกฤษ 20 คำ", done: false },
      { text: "เตรียมพรีเซนต์วันพุธ", done: false },
    ],
    noteLine: "อย่าลืมถามอาจารย์เรื่องเกรด...",
  },
  features: {
    label: "~ จุดเด่น ~",
    titleLine1: "ทุกอย่างที่ต้องการ",
    titleLine2: "ไม่มีอะไรเกินจำเป็น",
    desc: "ออกแบบมาให้เรียบง่ายสำหรับนักเรียน — จดโน้ต ทำเช็คลิสต์ จัดระเบียบ โดยไม่ต้องเรียนรู้อะไรซับซ้อน",
    cards: [
      {
        title: "จดโน้ตด้วยลายมือ",
        desc: "พิมพ์โน้ตแบบอิสระ รองรับภาษาไทยเต็มรูปแบบ ฟอนต์ลายมือสวยงามทำให้การจดรู้สึกเป็นธรรมชาติ",
      },
      {
        title: "เช็คลิสต์ & Todo",
        desc: "สร้างรายการสิ่งที่ต้องทำ ติ๊กเสร็จทีละข้อ ดูสถานะงานที่เหลือได้ในปุ่มเดียว ไม่มีหลุด",
      },
      {
        title: "จัดระเบียบด้วยโฟลเดอร์",
        desc: "แยกโน้ตตามวิชา ตามโปรเจค ตามอะไรก็ได้ ลากวางง่าย ค้นหาเร็ว หาเจอทุกอัน",
      },
    ],
  },
  how: {
    label: "~ วิธีใช้ ~",
    title: "เริ่มจดได้ใน 3 ขั้นตอน",
    desc: "ไม่ต้องสมัครสมาชิกยุ่งยาก ไม่ต้องตั้งค่าอะไรเยอะ เปิดมาก็จดได้เลย",
    steps: [
      {
        title: "สร้างสมุดโน้ต",
        desc: "ตั้งชื่อสมุดเล่มแรกของคุณ เลือกสีปก ตั้งหมวดหมู่ ใช้เวลาไม่ถึง 10 วินาที",
      },
      {
        title: "จดทุกอย่าง",
        desc: "เขียนโน้ต สร้าง Todo List จดไอเดียที่ผุดขึ้นมา ทุกอย่างบันทึกอัตโนมัติ",
      },
      {
        title: "จัดระเบียบ & ค้นหา",
        desc: "แท็ก ค้นหา กรองตามวัน — กลับมาหาโน้ตเก่าได้เสมอ ไม่มีหายไปไหน",
      },
    ],
  },
  testimonials: {
    label: "~ รีวิวจากผู้ใช้ ~",
    title: "เพื่อนๆ นักเรียนพูดถึงเรา",
    desc: "ลองฟังจากคนที่ใช้จริง — นักเรียน นักศึกษา และคนทำงานที่จดโน้ตทุกวัน",
    items: [
      {
        text: "ใช้มาหลายแอปแล้ว LungNote เป็นตัวเดียวที่เปิดมาก็จดได้เลย ไม่ต้องนั่งตั้งค่า ไม่ต้องเรียนรู้ระบบอะไรยุ่งยาก ฟอนต์ลายมือสวยมากด้วย",
        initial: "พ",
        name: "พลอย",
        role: "นักศึกษาปี 2 คณะอักษรศาสตร์ จุฬาฯ",
      },
      {
        text: "ชอบที่มันเรียบง่ายจริงๆ ไม่มีฟีเจอร์เยอะจนสับสน Todo List ช่วยจัดระเบียบการบ้านได้ดีมาก ติ๊กเสร็จทีละข้อรู้สึกดี",
        initial: "ก",
        name: "กันต์",
        role: "นักเรียน ม.5 โรงเรียนเตรียมอุดมฯ",
      },
      {
        text: "Sync ข้ามอุปกรณ์ดีมาก จดบนมือถือตอนนั่งรถ กลับบ้านเปิดคอมก็เจอโน้ตเหมือนเดิม ไม่เคยมีโน้ตหายเลยแม้แต่ครั้งเดียว",
        initial: "ม",
        name: "มิ้นท์",
        role: "นักศึกษาปี 3 คณะวิศวกรรมฯ มจธ.",
      },
    ],
  },
  download: {
    title: "ดาวน์โหลด",
    titleHighlight: "LungNote",
    desc: "ใช้ได้ทุกอุปกรณ์ ฟรีไม่มีค่าใช้จ่าย เปิดสมุดเล่มแรกได้วันนี้",
    appStore: "App Store",
    playStore: "Google Play",
    web: "เปิดบนเว็บ",
    note: "ฟรีตลอด ไม่ต้องใส่บัตรเครดิต",
  },
  faq: {
    label: "~ คำถามที่พบบ่อย ~",
    title: "มีคำถามไหม?",
    items: [
      {
        q: "LungNote ใช้ฟรีจริงไหม?",
        a: "ฟรีจริง สร้างสมุดโน้ตได้ไม่จำกัด จดได้ไม่จำกัด ฟีเจอร์หลักทั้งหมดใช้ได้ฟรี มีแพลน Pro สำหรับคนที่ต้องการ sync ข้ามอุปกรณ์และ backup อัตโนมัติ",
      },
      {
        q: "ใช้ได้บนอุปกรณ์อะไรบ้าง?",
        a: "ใช้ได้ทั้งบน iOS, Android, และ Web browser เปิดจดได้ทุกที่ ทั้งบนมือถือ แท็บเล็ต และคอมพิวเตอร์",
      },
      {
        q: "โน้ตจะหายไหมถ้าเปลี่ยนมือถือ?",
        a: "ไม่หาย สมัคร LungNote ด้วยอีเมลหรือ Google Account แล้วโน้ตทั้งหมดจะ sync อัตโนมัติ เปลี่ยนเครื่องก็ login แล้วเจอทุกอย่างเหมือนเดิม",
      },
      {
        q: "ต่างจากแอปจดโน้ตอื่นยังไง?",
        a: "LungNote ออกแบบมาเฉพาะสำหรับนักเรียนไทย — รองรับภาษาไทย 100% ฟอนต์ลายมือสวย ไม่มีฟีเจอร์รกรุงรัง เปิดมาก็จดได้เลย ไม่ต้องเสียเวลาเรียนรู้",
      },
      {
        q: "ข้อมูลปลอดภัยไหม?",
        a: "ปลอดภัย โน้ตทั้งหมดเข้ารหัสระหว่างส่งข้อมูล (TLS) และเก็บบน cloud ที่มีการเข้ารหัสแบบ at-rest เราไม่อ่านโน้ตของคุณ ไม่ขายข้อมูล ไม่มีโฆษณา",
      },
      {
        q: "มีแพลนสำหรับโรงเรียนไหม?",
        a: "มี! แพลน Education สำหรับโรงเรียนและมหาวิทยาลัย ครูจัดการห้องเรียนได้ นักเรียนแชร์โน้ตกันได้ ติดต่อทีมขายได้ที่ school@lungnote.app",
      },
    ],
  },
  footer: {
    tagline: "สร้างด้วยความตั้งใจ สำหรับนักเรียนที่ชอบจดโน้ต",
    copyright: (y) => `© ${y} LungNote`,
    terms: "ข้อกำหนด",
    privacy: "ความเป็นส่วนตัว",
    contact: "ติดต่อเรา",
  },
};

const en: LandingContent = {
  nav: {
    features: "Features",
    how: "How it works",
    reviews: "Reviews",
    faq: "FAQ",
    download: "Download",
  },
  hero: {
    eyebrow: "Note-taking for students",
    titleLine1: "Capture everything",
    titleBefore: "in your own ",
    titleHighlight: "handwriting",
    titleAfter: "",
    subtitle:
      "Notes, checklists, and ideas — all in one place. As simple as opening a fresh notebook.",
    cta: "Start writing — free →",
    notebookHeader: "My notes — today",
    todos: [
      { text: "Read chapter 5 of physics", done: true },
      { text: "Submit group report", done: true },
      { text: "Review 20 English vocabs", done: false },
      { text: "Prep Wednesday presentation", done: false },
    ],
    noteLine: "Don't forget to ask the teacher about grades...",
  },
  features: {
    label: "~ Features ~",
    titleLine1: "Everything you need",
    titleLine2: "Nothing you don't",
    desc: "Built simple for students — write, check off tasks, organize, without learning a thing.",
    cards: [
      {
        title: "Handwritten-feel notes",
        desc: "Free-form typing with full Thai support. The handwritten font makes note-taking feel natural.",
      },
      {
        title: "Checklists & Todos",
        desc: "Build task lists, tick them off one by one, see what's left at a glance. Nothing slips through.",
      },
      {
        title: "Folders that organize",
        desc: "Group notes by subject, project, anything. Drag-and-drop, fast search, find every note.",
      },
    ],
  },
  how: {
    label: "~ How ~",
    title: "Start writing in 3 steps",
    desc: "No signup hassle, no settings to tweak. Open it and start writing.",
    steps: [
      {
        title: "Create a notebook",
        desc: "Name your first notebook, pick a cover color, set a category — under 10 seconds.",
      },
      {
        title: "Write everything",
        desc: "Take notes, build todo lists, jot any idea that pops up. Saved automatically.",
      },
      {
        title: "Organize & search",
        desc: "Tag, search, filter by date — find old notes anytime, never lose a thing.",
      },
    ],
  },
  testimonials: {
    label: "~ User reviews ~",
    title: "What students say",
    desc: "Real users — students from high school, university, and working pros who write daily.",
    items: [
      {
        text: "Tried many apps. LungNote is the only one I can open and immediately use. No setup, no learning curve, and the handwritten font is gorgeous.",
        initial: "P",
        name: "Ploy",
        role: "Year 2, Faculty of Arts, Chulalongkorn University",
      },
      {
        text: "I love how simple it is. Not bloated with features. The todo list keeps my homework on track. Ticking things off feels great.",
        initial: "K",
        name: "Kan",
        role: "Grade 11, Triamudom Suksa School",
      },
      {
        text: "Cross-device sync is excellent. I write on the bus from my phone, then open my laptop at home and the notes are right there. Never lost a single note.",
        initial: "M",
        name: "Mint",
        role: "Year 3, Engineering, KMUTT",
      },
    ],
  },
  download: {
    title: "Get",
    titleHighlight: "LungNote",
    desc: "Available on every device. Free, forever. Open your first notebook today.",
    appStore: "App Store",
    playStore: "Google Play",
    web: "Open on web",
    note: "Free forever — no credit card.",
  },
  faq: {
    label: "~ FAQ ~",
    title: "Got questions?",
    items: [
      {
        q: "Is LungNote really free?",
        a: "Really. Unlimited notebooks, unlimited notes, all core features free. There's a Pro plan if you want cross-device sync and automatic backup.",
      },
      {
        q: "What devices does it run on?",
        a: "iOS, Android, and any modern web browser. Write on phone, tablet, or computer.",
      },
      {
        q: "Will my notes survive switching phones?",
        a: "Yes. Sign up with email or Google, and your notes sync automatically. Switch phones, log in, everything is right there.",
      },
      {
        q: "How is it different from other note apps?",
        a: "Built specifically for Thai students — full Thai support, beautiful handwritten font, no clutter. Open and start writing, no learning required.",
      },
      {
        q: "Is my data safe?",
        a: "Notes are encrypted in transit (TLS) and at rest in the cloud. We don't read your notes, sell your data, or show ads.",
      },
      {
        q: "Is there a school plan?",
        a: "Yes! Education plan for schools and universities — teachers manage classrooms, students share notes. Contact sales at school@lungnote.app.",
      },
    ],
  },
  footer: {
    tagline: "Built with care, for students who love taking notes",
    copyright: (y) => `© ${y} LungNote`,
    terms: "Terms",
    privacy: "Privacy",
    contact: "Contact",
  },
};

const map: Record<Locale, LandingContent> = { th, en };

export function getLandingContent(locale: Locale): LandingContent {
  return map[locale];
}
