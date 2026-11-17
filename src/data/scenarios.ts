export interface ScenarioQuestion {
  id: string;
  indexLabel: string;
  category: string;
  title: string;
  caption: string;
  imageUrl: string;
  correctSolutionId: string;
  hintText: string;
  promptEn: string;
}

export interface Game2Challenge {
  id: string;
  indexLabel: string;
  category: string;
  title: string;
  caption: string;
  imageUrl: string;
  correctChoiceId: string;
  choiceIds: [string, string, string];
  hintText: string;
  successTitle: string;
  successDetail: string;
  wrongExplanation: string;
}

export interface SolutionCard {
  id: string;
  code: string;
  isDecoy: boolean;
  matchQuestionId?: string;
  title: string;
  caption: string;
  imageUrl: string;
  feedbackTitle: string;
  feedbackDetail: string;
  promptEn: string;
}

export const UNIFORM_REFERENCE_PATH = '/assets/aistudio/_______-_Copy_9a0101bf.JPG';

export const PROMPT_SYSTEM_GUIDE = {
  conceptTitle: 'imex Frontline Match — แนวคิดเกมจับคู่สถานการณ์หน้างาน',
  targetAudience: 'พนักงาน imex ทุกสายงาน (คลังสินค้า บริการลูกค้า ประสานงาน และหน้างานจริง)',
  uniformAnchor:
    'wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo',
  artStyleFormula:
    'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, vibrant daylight colors, youthful webtoon art style',
  whyItWorks: [
    'ใช้ภาพเหตุการณ์จริงหน้างาน (Visual-First) คู่กับข้อความสั้น 1-2 บรรทัด อ่านปุ๊บเก็ตปั๊บ ไม่เครียดเหมือนข้อสอบ',
    'ตัวละครอ้างอิงคนจริงในลุคการ์ตูนเว็บตูนทันสมัย สวมยูนิฟอร์มโปโล imex สีกรมท่าขลิบฟ้าขาว เพิ่มความอินและเป็นกันเอง',
    'มีทั้งภาพคำตอบที่ถูกต้องและภาพคำตอบหลอก (กับดักความเคยชินหน้างาน) กระตุ้นให้พนักงานคิดวิเคราะห์ก่อนเลือก',
  ],
};

// เกมที่ 1: จับคู่สถานการณ์หน้างาน -> วิธีแก้ไขที่ถูกต้อง (Connect Board 4x6)
export const SCENARIO_QUESTIONS: ScenarioQuestion[] = [
  {
    id: 'q1',
    indexLabel: 'สถานการณ์ 01',
    category: 'บริการลูกค้า',
    title: 'ลูกค้าหัวร้อน พัสดุส่งช้ากว่ากำหนด',
    caption: 'ลูกค้าเดินมาที่เคาน์เตอร์ด้วยสีหน้าหงุดหงิด ชี้นาฬิกากับกล่องสินค้าแล้วบ่นว่าส่งช้ามาก',
    imageUrl: '/src/assets/images/q1_angry_customer_1794890351467.jpg',
    correctSolutionId: 'a1',
    hintText: 'หลักแรกเมื่อลูกค้าอารมณ์เสีย: ใจเย็น รับฟัง และรีบตรวจเช็กสถานะให้เห็นทางออกทันที',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, vibrant daylight colors. At a modern service counter, an upset customer is frowning and pointing at a watch and a delivery box, while a young Thai employee wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo listens attentively. Crisp modern workplace background, friendly youthful webtoon art style.',
  },
  {
    id: 'q2',
    indexLabel: 'สถานการณ์ 02',
    category: 'คลังสินค้า & QC',
    title: 'พบกล่องสินค้าบุบฉีกก่อนขึ้นรถส่ง',
    caption: 'ระหว่างตรวจเช็กสินค้าก่อนจัดส่ง พบกล่องพัสดุมีรอยยุบและฉีกขาดอยู่บนโต๊ะแพ็ก',
    imageUrl: '/src/assets/images/q2_damaged_box_1794890353706.jpg',
    correctSolutionId: 'a2',
    hintText: 'ห้ามปล่อยของมีตำหนิหลุดมือ! ต้องบันทึกหลักฐาน กักแยก QC และเปลี่ยนกล่องใหม่ที่สมบูรณ์',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, bright warehouse lighting. A young Thai staff member wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo looks concerned while inspecting a dented and torn cardboard shipping box on a packing table before delivery. Clean modern warehouse interior, youthful webtoon illustration.',
  },
  {
    id: 'q3',
    indexLabel: 'สถานการณ์ 03',
    category: 'ทีมเวิร์กหน้างาน',
    title: 'ช่วงพีคคิวยาว เพื่อนร่วมทีมรับมือไม่ทัน',
    caption: 'จุดปล่อยของมีออเดอร์ค้าง 25+ คิว เพื่อนร่วมงานกำลังเหงื่อตกเพราะคนรอแน่นเคาน์เตอร์',
    imageUrl: '/src/assets/images/q3_rush_hour_1794890355315.jpg',
    correctSolutionId: 'a3',
    hintText: 'หน้างานคือทีมเดียวกัน เมื่อเห็นเพื่อนล้นมือ ต้องรีบเข้าไปช่วยแบ่งงานและแพ็กทันที',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, dynamic energetic lighting. A young Thai employee wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo is overwhelmed behind a busy dispatch desk piled with orders and waiting customers in queue, wiping sweat in a hurry. Modern bright workplace, youthful webtoon style.',
  },
  {
    id: 'q4',
    indexLabel: 'สถานการณ์ 04',
    category: 'ความปลอดภัยหน้างาน',
    title: 'น้ำหกใกล้ปลั๊กไฟและกล่องขวางทางเดิน',
    caption: 'เดินผ่านโถงทางเดินแล้วเจอน้ำหกใกล้รางปลั๊กไฟ แถมมีกล่องวางเกะกะขวางทาง',
    imageUrl: '/src/assets/images/q4_safety_hazard_1794890356917.jpg',
    correctSolutionId: 'a4',
    hintText: 'เห็นจุดเสี่ยงอุบัติเหตุหน้างานเมื่อไหร่ อย่ารอคนอื่น! ตั้งป้ายเตือน เช็ดแห้ง และเคลียร์ทางเดิน',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, clear indoor lighting. A young Thai staff member wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo stops in surprise while noticing spilled water on the walkway floor near a power strip and stacked boxes blocking the aisle. Modern workplace corridor, youthful webtoon style.',
  },
];

// เกมที่ 2: ดวลการ์ดจับผิด & คัดกรองพฤติกรรมเสี่ยงหน้างาน (ตั้งโจทย์คนละมุมกับเกมที่ 1)
export const GAME2_CHALLENGES: Game2Challenge[] = [
  {
    id: 'g2_1',
    indexLabel: 'ภารกิจ 01',
    category: 'จับผิดพฤติกรรมทีม',
    title: 'ภาพใดคือ "พฤติกรรมต้องห้าม" เมื่อทีมกำลังเจองานล้นมือ?',
    caption: 'ช่วงเร่งด่วนหน้าเคาน์เตอร์มีคิวรอแน่น หากเพื่อนพนักงานทำแบบภาพใดจะยิ่งทำให้งานทั้งทีมสะดุด?',
    imageUrl: '/src/assets/images/q3_rush_hour_1794890355315.jpg',
    correctChoiceId: 'd2',
    choiceIds: ['d2', 'a3', 'a2'],
    hintText: 'สังเกตภาพที่พนักงานนิ่งเฉยไม่สนใจเพื่อนที่กำลังแบกกล่องอยู่ด้านหลัง',
    successTitle: 'ตาไวมาก! จับจุดบอดทีมเวิร์กได้ทันที',
    successDetail: 'การปล่อยเพื่อนแบกงานหนักคนเดียวแล้วนั่งเล่นมือถือคือพฤติกรรมที่ทำลายสปิริตทีมและทำให้งานช้าลง',
    wrongExplanation: 'ภาพที่เลือกเป็นการปฏิบัติงานตามมาตรฐานที่ดี — โจทย์นี้ให้จับภาพ "พฤติกรรมต้องห้าม" นะ!',
  },
  {
    id: 'g2_2',
    indexLabel: 'ภารกิจ 02',
    category: 'จับผิดมาตรฐาน QC',
    title: 'ข้อใดคือ "ทางลัดที่ผิดมาตรฐาน imex" ห้ามทำกับกล่องบุบเด็ดขาด?',
    caption: 'ก่อนขึ้นรถขนส่งพบกล่องมีรอยยุบฉีกขาด ภาพใดคือการแก้ปัญหาแบบมักง่ายที่จะทำให้ลูกค้าเคลม?',
    imageUrl: '/src/assets/images/q2_damaged_box_1794890353706.jpg',
    correctChoiceId: 'd3',
    choiceIds: ['d3', 'a2', 'a4'],
    hintText: 'มองหาภาพที่พยายามปกปิดรอยชำรุดด้วยวิธีมักง่ายแทนการเปลี่ยนกล่อง',
    successTitle: 'สุดยอดนักตรวจ QC!',
    successDetail: 'การเอาเทปใสพันทับกล่องที่ยุบเพื่อปกปิดรอยเสียหายจะทำลายความน่าเชื่อถือเมื่อสินค้าถึงมือลูกค้า',
    wrongExplanation: 'ภาพนี้เป็นขั้นตอนที่ถูกต้องตามมาตรฐาน — ลองหาภาพ "ทางลัดแบบมักง่าย" ที่ห้ามทำ!',
  },
  {
    id: 'g2_3',
    indexLabel: 'ภารกิจ 03',
    category: 'วิเคราะห์ความเสี่ยงบริการ',
    title: 'เมื่อลูกค้าไม่พอใจ การรับมือแบบใดเสี่ยงถูกคอมเพลนหนักที่สุด?',
    caption: 'ลูกค้ากำลังอารมณ์เสียจากความล่าช้า การตอบสนองในภาพใดจะทำให้สถานการณ์บานปลาย?',
    imageUrl: '/src/assets/images/q1_angry_customer_1794890351467.jpg',
    correctChoiceId: 'd1',
    choiceIds: ['d1', 'a1', 'a3'],
    hintText: 'มองหาภาพที่พนักงานใช้อารมณ์และอ้างกฎระเบียบมาปะทะกับลูกค้าตรง ๆ',
    successTitle: 'วิเคราะห์เกมขาดมาก!',
    successDetail: 'การกอดอกเถียงกลับหรือชี้กฎใส่ลูกค้าที่กำลังหัวร้อนคือชนวนเหตุที่ทำให้เรื่องเล็กกลายเป็นดราม่าใหญ่',
    wrongExplanation: 'ภาพนี้ช่วยคลี่คลายสถานการณ์ให้ดีขึ้น — โจทย์ถามถึงภาพที่ "เสี่ยงถูกคอมเพลนหนักที่สุด" นะ!',
  },
  {
    id: 'g2_4',
    indexLabel: 'ภารกิจ 04',
    category: 'ตัดสินใจ Safety เร่งด่วน',
    title: 'เจอพื้นที่เปียกใกล้ปลั๊กไฟ ต้องลงมือทำตามภาพใดทันทีเป็นอันดับแรก?',
    caption: 'เพื่อป้องกันไฟดูดและอุบัติเหตุลื่นล้มในโถงทางเดิน ภาพใดคือการจัดการที่ปลอดภัยและครบถ้วนที่สุด?',
    imageUrl: '/src/assets/images/q4_safety_hazard_1794890356917.jpg',
    correctChoiceId: 'a4',
    choiceIds: ['a4', 'd2', 'd3'],
    hintText: 'ด่านนี้ถามหาวิธีแก้ไขที่ถูกต้อง: ต้องมีป้ายเตือน เช็ดพื้นให้แห้ง และเคลียร์กล่องพ้นทางเดิน',
    successTitle: 'ปิดจ๊อบปลอดภัย 100%!',
    successDetail: 'เห็นจุดเสี่ยงแล้วต้องวางป้ายเตือน เช็ดแห้ง และจัดกล่องเข้าชั้นทันที ไม่ผลักภาระให้คนอื่น',
    wrongExplanation: 'วิธีนี้ไม่ช่วยลดอันตรายจากน้ำและกล่องขวางทางเดินเลย รีบเลือกภาพที่แก้ไขครบขั้นตอน!',
  },
];

export const SOLUTION_CARDS: SolutionCard[] = [
  {
    id: 'a1',
    code: 'SOL-01',
    isDecoy: false,
    matchQuestionId: 'q1',
    title: 'ยิ้มรับฟังอย่างใจเย็น + เช็กแทร็กให้ทันที',
    caption: 'ขออภัยด้วยความจริงใจ เปิดแท็บเล็ตเช็กสถานะสดและแจ้งเวลาถึงมือให้ลูกค้าสบายใจ',
    imageUrl: '/src/assets/images/a1_calm_solution_1794890351498.jpg',
    feedbackTitle: 'สุดยอด! รับมือมืออาชีพ',
    feedbackDetail: 'การรับฟังอย่างสุภาพและอัปเดตข้อมูลจริงบนแท็บเล็ตช่วยลดอารมณ์โกรธและสร้างความเชื่อมั่นทันที',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, warm bright lighting. A young Thai employee wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo smiles calmly, bowing slightly while showing delivery tracking on a tablet to a relieved, smiling customer at a service desk. Youthful modern illustrated webtoon style.',
  },
  {
    id: 'a2',
    code: 'SOL-02',
    isDecoy: false,
    matchQuestionId: 'q2',
    title: 'ถ่ายรูปหลักฐาน + ติดป้าย QC Hold + เปลี่ยนกล่องใหม่',
    caption: 'บันทึกภาพกล่องชำรุด แยกเข้าโซน QC และเปลี่ยนสินค้ากล่องใหม่สมบูรณ์ก่อนจัดส่ง',
    imageUrl: '/src/assets/images/a2_qc_replace_1794890354227.jpg',
    feedbackTitle: 'เป๊ะมาก! มาตรฐานคุณภาพเต็มร้อย',
    feedbackDetail: 'การบันทึกภาพและคัดแยก QC ก่อนส่งมอบช่วยป้องกันการเคลมซ้ำซ้อนและรักษาภาพลักษณ์แบรนด์',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, crisp bright lighting. A diligent young Thai staff member wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo takes a photo of the damaged box with a smartphone, puts an orange QC hold tag on it, and prepares a fresh undamaged box beside it. Clean modern warehouse, youthful webtoon style.',
  },
  {
    id: 'a3',
    code: 'SOL-03',
    isDecoy: false,
    matchQuestionId: 'q3',
    title: 'รีบเข้าไปช่วยแบ่งงานและเคลียร์คิวคู่กัน',
    caption: 'ช่วยเพื่อนเช็กบิลและยื่นพัสดุหน้าเคาน์เตอร์ แบ่งเบาภาระให้ลูกค้าได้รับของไวขึ้น',
    imageUrl: '/src/assets/images/a3_teamwork_help_1794890354698.jpg',
    feedbackTitle: 'ทีมเวิร์กขั้นเทพ!',
    feedbackDetail: 'เมื่อจุดหนึ่งเกิดคอขวด การกระโดดเข้าไปช่วยแบ่งงานช่วยให้ทั้งทีมผ่านช่วงเร่งด่วนได้อย่างราบรื่น',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, uplifting warm bright lighting. Two young Thai teammates both wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo work smoothly side by side at a busy dispatch counter, smiling and handing off packages efficiently to clear the queue. Modern office/store, youthful webtoon style.',
  },
  {
    id: 'a4',
    code: 'SOL-04',
    isDecoy: false,
    matchQuestionId: 'q4',
    title: 'ตั้งป้ายเตือนพื้นลื่น + เช็ดแห้ง + เก็บกล่องเข้าชั้น',
    caption: 'วางป้ายระวังลื่น เช็ดน้ำให้แห้งปลอดภัย และยกกล่องที่ขวางทางขึ้นชั้นจัดเก็บเรียบร้อย',
    imageUrl: '/src/assets/images/a4_safety_fix_1794890357765.jpg',
    feedbackTitle: 'ใส่ใจ Safety First!',
    feedbackDetail: 'การจัดการจุดเสี่ยงทันทีที่พบช่วยป้องกันอุบัติเหตุไฟดูด ลื่นล้ม และทางหนีไฟถูกกีดขวาง',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, clean bright safety lighting. A proactive young Thai staff member wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo places a bright yellow wet floor caution sign, wipes the spill dry, and neatly stacks the boxes away on a shelf leaving a clear walkway. Youthful webtoon style.',
  },
  {
    id: 'd1',
    code: 'TRAP-01',
    isDecoy: true,
    title: 'กอดอกเถียงกลับ อ้างกฎข้อบังคับใส่ลูกค้า',
    caption: 'ทำหน้าบึ้งชี้คู่มือกฎบริษัทใส่ลูกค้าแบบไม่ฟังเหตุผล ทำให้สถานการณ์ตึงเครียดกว่าเดิม',
    imageUrl: '/src/assets/images/d1_argue_trap_1794890352446.jpg',
    feedbackTitle: 'อุ๊ย! กับดักอารมณ์ร้อน',
    feedbackDetail: 'การเถียงกลับหรือโยนกฎใส่ลูกค้าที่กำลังหงุดหงิดจะยิ่งทำให้เรื่องบานปลายและเสียลูกค้าทันที',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, humorous dramatic comic lighting. A grumpy young Thai employee wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo crosses their arms stubbornly and points at a rulebook while arguing back at an annoyed customer across the counter. Youthful webtoon style.',
  },
  {
    id: 'd2',
    code: 'TRAP-02',
    isDecoy: true,
    title: 'นั่งจิบกาแฟไถมือถือ มองเพื่อนเหนื่อยอยู่ข้างหลัง',
    caption: 'คิดว่าไม่ใช่หน้าที่ตัวเอง นั่งชิลล์ไถฟีดปล่อยให้เพื่อนแบกกองกล่องท่วมหัวคนเดียว',
    imageUrl: '/src/assets/images/d2_ignore_phone_trap_1794890356240.jpg',
    feedbackTitle: 'อุ๊ย! กับดัก "ไม่ใช่หน้าที่เรา"',
    feedbackDetail: 'การเพิกเฉยเมื่อเพื่อนหน้างานกำลังล้นมือทำให้งานทั้งระบบช้าลงและทำลายบรรยากาศทีมเวิร์ก',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, comic contrast lighting. A young Thai employee wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo leans back scrolling casually on a smartphone and sipping iced coffee while in the background a coworker struggles with a huge pile of boxes. Youthful webtoon style.',
  },
  {
    id: 'd3',
    code: 'TRAP-03',
    isDecoy: true,
    title: 'เอาเทปใสพันทับกล่องบุบ แล้วส่งออกไปทั้งแบบนั้น',
    caption: 'รีบพันเทปใสหนา ๆ ปิดรอยฉีกให้ดูเหมือนปกติ หวังว่าลูกค้าคงไม่สังเกตเห็น',
    imageUrl: '/src/assets/images/d3_tape_over_trap_1794890354547.jpg',
    feedbackTitle: 'อุ๊ย! กับดัก "พันเทปแก้ขัด"',
    feedbackDetail: 'การปกปิดสภาพกล่องชำรุดทำให้สินค้าข้างในเสี่ยงเสียหายและลูกค้าขาดความไว้วางใจเมื่อเปิดรับของ',
    promptEn:
      'Modern stylized 2D comic illustration based on real young Thai adults, clean expressive lineart, playful comic tone. A careless young Thai staff member wearing the exact dark navy blue polo shirt from the reference image with white and sky-blue collar stripes, sleeve stripes, three white buttons, and small white "imex" chest logo hastily wraps messy layers of clear packing tape over a badly crushed cardboard box to hide the damage while whistling casually. Clean warehouse background, youthful webtoon illustration.',
  },
];
