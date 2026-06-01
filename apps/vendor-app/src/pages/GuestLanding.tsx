import { GuestLanding as SharedGuestLanding } from "@workspace/auth-react";
import { useLocation } from "wouter";

export function GuestLanding() {
  const [, navigate] = useLocation();
  return (
    <SharedGuestLanding
        role="vendor"
        logoSrc="/ajkmart-logo.png"
        logoAlt="AJKMart"
        appName="AJKMart Vendor"
        heroTitle={{ en: "Grow Your Business with AJKMart", ur: "اپنا کاروبار بڑھائیں", roman: "Apna karobar barhayein" }}
        heroSubtitle={{ en: "Sell Smart. Grow Fast. Reach every home across AJK.", ur: "سمارٹ بیچیں۔ تیزی سے بڑھیں۔", roman: "Smart Bechayn. Tezi Se Barhayn." }}
        stats={[
          { v: "4,200+", l: { en: "Active vendors", ur: "فعال وینڈرز", roman: "Active vendors" }, icon: "store" },
          { v: "18", l: { en: "Cities", ur: "شہر", roman: "Shehar" }, icon: "city" },
          { v: "2.1M+", l: { en: "Orders processed", ur: "آرڈرز", roman: "Orders process hue" }, icon: "order" },
          { v: "4.7★", l: { en: "Vendor rating", ur: "وینڈر ریٹنگ", roman: "Vendor rating" }, icon: "star" },
        ]}
        features={[
          {
            icon: "grid",
            title: { en: "Order Dashboard", ur: "آرڈر ڈیش بورڈ", roman: "Order Dashboard" },
            desc: { en: "Accept, manage, and track every order in real time with push alerts.", ur: "ہر آرڈر کو حقیقی وقت میں ٹریک کریں۔", roman: "Har order real time mein track karein." },
            color: "#1A56DB",
          },
          {
            icon: "trendUp",
            title: { en: "Sales Analytics", ur: "سیلز اینالیٹکس", roman: "Sales Analytics" },
            desc: { en: "Revenue charts, top products, and daily summaries at your fingertips.", ur: "آمدنی چارٹس اور یومیہ خلاصہ۔", roman: "Amdani charts aur yaumia khulasa." },
            color: "#F97316",
          },
          {
            icon: "store",
            title: { en: "Inventory Management", ur: "انوینٹری", roman: "Inventory" },
            desc: { en: "Upload items, set prices, manage stock, and run promotions.", ur: "اشیاء اپلوڈ کریں اور اسٹاک منیج کریں۔", roman: "Ashiya upload karein, stock manage karein." },
            color: "#10B981",
          },
          {
            icon: "wallet",
            title: { en: "Instant Payouts", ur: "فوری ادائیگی", roman: "Fori Adaigi" },
            desc: { en: "Earnings go to your digital wallet automatically. Withdraw anytime.", ur: "آمدنی والیٹ میں خودبخود آتی ہے۔", roman: "Amdani wallet mein khud-ba-khud aati hai." },
            color: "#8B5CF6",
          },
        ]}
        steps={[
          {
            icon: "fileCheck",
            title: { en: "Register Your Store", ur: "دکان رجسٹر کریں", roman: "Dukaan register karein" },
            desc: { en: "Sign up in minutes with your CNIC and store details.", ur: "اپنے شناختی کارڈ اور دکان کی تفصیلات کے ساتھ فوری رجسٹر ہوں۔", roman: "Apne CNIC aur dukaan ki tafseelat ke sath fori register hon." },
          },
          {
            icon: "store",
            title: { en: "Add Products", ur: "اشیاء شامل کریں", roman: "Ashiya shamil karein" },
            desc: { en: "Upload your catalog, set prices, and manage stock levels.", ur: "اپنی کیٹلاگ اپلوڈ کریں، قیمتیں طے کریں اور اسٹاک منیج کریں۔", roman: "Apni catalog upload karein, qeematain tey karein, aur stock manage karein." },
          },
          {
            icon: "zap",
            title: { en: "Start Receiving Orders", ur: "آرڈرز وصول کریں", roman: "Orders wasool karein" },
            desc: { en: "Get real-time order alerts and manage deliveries from your dashboard.", ur: "حقیقی وقت میں آرڈر الرٹس حاصل کریں اور ڈیلیوری منیج کریں۔", roman: "Real time mein order alerts hasil karein aur delivery manage karein." },
          },
        ]}
        testimonials={[
          {
            quote: { en: "My sales doubled in the first month. The dashboard makes managing orders effortless.", ur: "پہلے مہینے میری فروخت دگنی ہو گئی۔ ڈیش بورڈ آرڈر منیج کرنا آسان بنا دیتا ہے۔", roman: "Pehle mahine meri farokht dugni ho gayi. Dashboard order manage karna asan bana deta hai." },
            author: "Kashif A.",
            role: "Grocery Vendor",
            city: "Mirpur",
          },
          {
            quote: { en: "Instant payouts changed everything. I no longer wait weeks to get my money.", ur: "فوری ادائیگیوں نے سب کچھ بدل دیا۔ اب ہفتوں انتظار نہیں کرنا پڑتا۔", roman: "Fori adaigiyon ne sab kuch badal diya. Ab hafton intezar nahi karna parta." },
            author: "Fatima R.",
            role: "Pharmacy Owner",
            city: "Muzaffarabad",
          },
          {
            quote: { en: "The analytics help me understand what sells best. A game-changer for my store.", ur: "اینالیٹکس مجھے بتاتے ہیں کہ سب سے زیادہ کون سی چیز بیچتی ہے۔", roman: "Analytics mujhe batate hain ke sab se zyada kaun si cheez bechti hai." },
            author: "Ahmed S.",
            role: "Restaurant Partner",
            city: "Kotli",
          },
        ]}
        faqs={[
          {
            q: { en: "How do I register as a vendor?", ur: "وینڈر کے طور پر کیسے رجسٹر ہوں؟", roman: "Vendor ke tor par kaise register hon?" },
            a: { en: "Click 'Open Your Shop', fill in your CNIC, store name, and contact details. Approval usually takes 24 hours.", ur: "'دکان کھولیں' پر کلک کریں، اپنا شناختی کارڈ، دکان کا نام اور رابطہ کی تفصیلات درج کریں۔", roman: "'Dukaan Kholyein' par click karein, apna CNIC, dukaan ka naam, aur rabta ki tafseelat darj karein." },
          },
          {
            q: { en: "What documents are required?", ur: "کن دستاویزات کی ضرورت ہے؟", roman: "Kaun documents ki zaroorat hai?" },
            a: { en: "You need a valid CNIC, a bank account for payouts, and your business registration (if applicable).", ur: "آپ کو ایک درست شناختی کارڈ، ادائیگیوں کے لیے بینک اکاؤنٹ، اور اپنے کاروبار کی رجسٹریشن (اگر لاگو ہو) درکار ہے۔", roman: "Aap ko ek durust CNIC, adaigiyon ke liye bank account, aur apne karobar ki registration (agar laagu ho) darkaar hai." },
          },
          {
            q: { en: "How and when do I get paid?", ur: "میں کیسے اور کب ادائیگی وصول کروں گا؟", roman: "Main kaise aur kab adaygi wasool karunga?" },
            a: { en: "Earnings are instantly credited to your AJKMart wallet after each completed order. You can withdraw to your bank anytime.", ur: "آمدنی ہر مکمل آرڈر کے بعد فوری طور پر آپ کے AJKMart والیٹ میں جمع ہو جاتی ہے۔", roman: "Amdani har mukammal order ke baad fori tor par aapke AJKMart wallet mein jama ho jati hai." },
          },
          {
            q: { en: "Is there a commission fee?", ur: "کیا کمیشن فیس ہے؟", roman: "Kya commission fee hai?" },
            a: { en: "AJKMart charges a small platform fee per order. Exact rates are shown transparently in your vendor agreement.", ur: "AJKMart فی آرڈر ایک چھوٹی سی پلیٹ فارم فیس لیتی ہے۔ درست شرحیں آپ کے وینڈر معاہدے میں شفاف طور پر دکھائی جاتی ہیں۔", roman: "AJKMart per order ek chhoti si platform fee leti hai. Darust sharhein aap ke vendor moahiday mein shaffaf tor par dikhayi jati hain." },
          },
        ]}
        trustBadges={[
          {
            icon: "shield",
            title: { en: "KYC Verified", ur: "KYC تصدیق شدہ", roman: "KYC tasdeeq shuda" },
            desc: { en: "Every vendor is identity-verified for a trusted marketplace.", ur: "ہر وینڈر کی شناخت کی تصدیق ہوتی ہے۔", roman: "Har vendor ki shanakht ki tasdeeq hoti hai." },
          },
          {
            icon: "lock",
            title: { en: "Secure Payments", ur: "محفوظ ادائیگیاں", roman: "Mehfooz adaigiyan" },
            desc: { en: "Bank-grade encryption for all wallet transactions.", ur: "تمام والیٹ لین دین کے لیے بینک سطح کی انکرپشن۔", roman: "Tamam wallet lein dein ke liye bank satah ki encryption." },
          },
          {
            icon: "check",
            title: { en: "Instant Settlements", ur: "فوری تصفیہ", roman: "Fori tasfiya" },
            desc: { en: "No more weekly waits. Get paid per order.", ur: "ہفتہ وار انتظار نہیں۔ فی آرڈر ادائیگی۔", roman: "Haftawar intezar nahi. Per order adaygi." },
          },
        ]}
        ctaLoginLabel={{ en: "Login", ur: "لاگ ان", roman: "Login Karein" }}
        ctaRegisterLabel={{ en: "Open Your Shop", ur: "دکان کھولیں", roman: "Dukaan Kholyein" }}
        supportPhone="+92-300-1234567"
        supportEmail="vendors@ajkmart.com"
        footerLinks={[
          { label: { en: "Terms of Service", ur: "سروس کی شرائط", roman: "Service ki sharait" }, href: "#terms" },
          { label: { en: "Privacy Policy", ur: "رازداری کی پالیسی", roman: "Razdari ki policy" }, href: "#privacy" },
          { label: { en: "Help Center", ur: "مدد کا مرکز", roman: "Madad ka markaz" }, href: "#help" },
        ]}
        onLogin={() => navigate("/login")}
        onRegister={() => navigate("/register")}
      />
  );
}

export default GuestLanding;
