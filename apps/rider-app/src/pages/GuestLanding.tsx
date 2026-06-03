import { GuestLanding as SharedGuestLanding } from "@workspace/auth-react";
import { tDual, type Language, type TranslationKey } from "@workspace/i18n";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../lib/rider-auth";
import { riderTheme } from "../lib/auth/theme";
import { useLanguage } from "../lib/useLanguage";

export function GuestLanding() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { language, setLanguage } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  /* Gap 4: Show a brief toast when redirected here after a token_expired logout.
     The ?reason=expired param is set by rider-auth.tsx on token_expired only.
     Immediately clean the URL so a reload doesn't re-trigger the toast. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "expired") {
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        /* non-critical */
      }
      toast({
        title: T("sessionExpiredLoginMsg"),
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SharedGuestLanding
        role="rider"
        language={language as "en" | "ur" | "roman"}
        onLanguageChange={(l) => setLanguage(l as Language)}
        logoSrc={import.meta.env.BASE_URL.replace(/\/$/, "") + "/ajkmart-logo.png"}
        logoAlt="AJKMart"
        appName="AJKMart Rider"
        heroTitle={{ en: "Earn More. Ride Free.", ur: "زیادہ کمائیں۔ آزاد سفر کریں۔", roman: "Zyada Kamayen. Azad Safar karen." }}
        heroSubtitle={{ en: "Join thousands of riders across AJK and earn whenever you want.", ur: "ہزاروں رائیڈرز کے ساتھ شامل ہوں اور جب چاہیں کمائیں۔", roman: "Hazaron riders ke sath shamil hon aur jab chahen kamayein." }}
        stats={[
          { v: "₨ 2,400", l: { en: "Avg daily earnings", ur: "اوسط یومیہ آمدن", roman: "Avg roz ki kamai" }, icon: "wallet" },
          { v: "11,114+", l: { en: "Active riders", ur: "فعال رائیڈرز", roman: "Active riders" }, icon: "rider" },
          { v: "17", l: { en: "Cities covered", ur: "شہر", roman: "Shehar" }, icon: "city" },
          { v: "4.8★", l: { en: "App rating", ur: "ایپ ریٹنگ", roman: "App rating" }, icon: "star" },
        ]}
        features={[
          {
            icon: "zap",
            color: riderTheme.primary,
            title: { en: "Instant Payouts", ur: "فوری ادائیگی", roman: "Fori Adaygi" },
            desc: { en: "Earnings hit your wallet the moment a delivery is complete — no weekly waits.", ur: "جیسے ہی ڈیلیوری مکمل ہو، کمائی فوراً والیٹ میں آ جاتی ہے۔", roman: "Delivery mukammal hotay hi kamai foran wallet mein aa jati hai." },
          },
          {
            icon: "navigation",
            color: riderTheme.featureGreen,
            title: { en: "Live Navigation", ur: "لائیو نیویگیشن", roman: "Live Navigation" },
            desc: { en: "Built-in GPS routing shows the fastest route in real time, even on slow data.", ur: "بلٹ ان جی پی ایس سست ڈیٹا پر بھی سب سے تیز راستہ دکھاتا ہے۔", roman: "Built-in GPS slow data par bhi tez tareen rasta dikhata hai." },
          },
          {
            icon: "clock",
            color: riderTheme.featureBlue,
            title: { en: "Flexible Hours", ur: "لچکدار اوقات", roman: "Lachakdar Auqat" },
            desc: { en: "Go online when it suits you. No fixed shifts, no penalties for logging off.", ur: "جب چاہیں آن لائن جائیں، کوئی فکسڈ شفٹ نہیں، کوئی جرمانہ نہیں۔", roman: "Jab chahen online jayen, koi fixed shift nahi, koi jurmana nahi." },
          },
          {
            icon: "gift",
            color: riderTheme.featurePurple,
            title: { en: "Bonus Rewards", ur: "بونس انعامات", roman: "Bonus Inaam" },
            desc: { en: "Hit delivery milestones to unlock surge bonuses, weekend boosts, and fuel allowances.", ur: "ڈیلیوری اہداف پورے کریں اور سرج بونس، ویکنڈ بوسٹ اور فیول الاؤنس پائیں۔", roman: "Delivery targets pore karen aur surge bonus, weekend boost aur fuel allowance payen." },
          },
        ]}
        steps={[
          {
            icon: "fileCheck",
            title: { en: "Register & Verify", ur: "رجسٹر اور تصدیق", roman: "Register aur tasdeeq" },
            desc: { en: "Sign up with your phone, upload your CNIC and vehicle documents.", ur: "اپنے فون سے سائن اپ کریں، شناختی کارڈ اور گاڑی کے کاغذات اپلوڈ کریں۔", roman: "Apne phone se sign up karein, CNIC aur gaari ke kaghzat upload karein." },
          },
          {
            icon: "bike",
            title: { en: "Go Online", ur: "آن لائن جائیں", roman: "Online jayen" },
            desc: { en: "Toggle your status to online and start receiving ride & delivery requests near you.", ur: "اپنی حیثیت کو آن لائن کریں اور قریب کے سواری اور ڈیلیوری کی درخواستیں وصول کریں۔", roman: "Apni haisiyat ko online karein aur qareeb ke sawari aur delivery ki darkhwastain wasool karein." },
          },
          {
            icon: "wallet",
            title: { en: "Earn & Withdraw", ur: "کمائیں اور نکلوائیں", roman: "Kamayen aur niklwain" },
            desc: { en: "Complete trips, get paid instantly to your wallet, and withdraw to your bank anytime.", ur: "سفریات مکمل کریں، فوری والیٹ میں ادائیگی حاصل کریں، اور کسی بھی وقت بینک میں نکلوائیں۔", roman: "Safariyaat mukammal karein, fori wallet mein adaygi hasil karein, aur kisi bhi waqt bank mein niklwain." },
          },
        ]}
        testimonials={[
          {
            quote: { en: "I earn more in a day than I used to in a week at my old job. AJKMart changed my life.", ur: "میں ایک دن میں اتنی کمائی کرتا ہوں جتنی پرانی نوکری میں ایک ہفتے میں نہیں ہوتی تھی۔", roman: "Main ek din mein itni kamai karta hon jitni purani nokri mein ek haftay mein nahi hoti thi." },
            author: "Imran K.",
            role: "Full-time Rider",
            city: "Mirpur",
          },
          {
            quote: { en: "The instant payout feature is amazing. I can fuel up and get back on the road right away.", ur: "فوری ادائیگی کا فیچر حیرت انگیز ہے۔ میں فوری طور پر پیٹرول ڈلوا کر واپس سڑک پر نکل سکتا ہوں۔", roman: "Fori adaygi ka feature hairat angez hai. Main fori tor par petrol dilwa kar wapas sarak par nikal sakta hon." },
            author: "Hassan A.",
            role: "Bike Rider",
            city: "Muzaffarabad",
          },
          {
            quote: { en: "Flexible hours let me study in the morning and ride in the evening. Perfect for students.", ur: "لچکدار اوقات مجھے صبح پڑھنے اور شام میں سواری کرنے کی اجازت دیتے ہیں۔", roman: "Lachakdar auqaat mujhe subah parhne aur shaam mein sawari karne ki ijazat dete hain." },
            author: "Ali R.",
            role: "Part-time Rider",
            city: "Kotli",
          },
        ]}
        faqs={[
          {
            q: { en: "How do I join as a rider?", ur: "رائیڈر کے طور پر کیسے شامل ہوں؟", roman: "Rider ke tor par kaise shamil hon?" },
            a: { en: "Tap 'Join as Rider', enter your phone number, upload your CNIC and vehicle documents. Approval is typically within 24 hours.", ur: "'رائیڈر بنیں' پر ٹیپ کریں، اپنا فون نمبر درج کریں، شناختی کارڈ اور گاڑی کے کاغذات اپلوڈ کریں۔", roman: "'Rider Banein' par tap karein, apna phone number darj karein, CNIC aur gaari ke kaghzat upload karein." },
          },
          {
            q: { en: "What are the vehicle requirements?", ur: "گاڑی کی کیا شرائط ہیں؟", roman: "Gaari ki kya sharaait hain?" },
            a: { en: "You need a valid bike, car, or van with up-to-date registration and insurance. Electric vehicles are welcome too.", ur: "آپ کو ایک درست موٹر سائیکل، کار، یا وین درکار ہے جس کی رجسٹریشن اور انشورنس تازہ ترین ہو۔", roman: "Aap ko ek durust bike, car, ya van darkaar hai jis ki registration aur insurance taaza tareen ho." },
          },
          {
            q: { en: "When and how do I get paid?", ur: "ادائیگی کب اور کیسے ملتی ہے؟", roman: "Adaygi kab aur kaise milti hai?" },
            a: { en: "Every completed trip pays instantly into your AJKMart wallet. Withdraw to your linked bank account anytime with zero fees.", ur: "ہر مکمل سفر کی ادائیگی فوری طور پر آپ کے AJKMart والیٹ میں ہوتی ہے۔", roman: "Har mukammal safar ki adaygi fori tor par aapke AJKMart wallet mein hoti hai." },
          },
          {
            q: { en: "Are there any bonuses or incentives?", ur: "کیا کوئی بونس یا مراعات ہیں؟", roman: "Kya koi bonus ya maraat hain?" },
            a: { en: "Yes! We offer surge bonuses during peak hours, weekend boosts, fuel allowances, and referral rewards.", ur: "ہاں! ہم مصروف اوقات میں سرج بونس، ویکنڈ بوسٹ، فیول الاؤنس، اور ریفرل انعامات پیش کرتے ہیں۔", roman: "Han! Hum masroof auqaat mein surge bonus, weekend boost, fuel allowance, aur referral inamaat paish karte hain." },
          },
        ]}
        trustBadges={[
          {
            icon: "shield",
            title: { en: "Verified Partners", ur: "تصدیق شدہ شراکت دار", roman: "Tasdeeq shuda sharakat-daar" },
            desc: { en: "Every rider is background-checked and verified.", ur: "ہر رائیڈر کی پس منظر چیکنگ اور تصدیق ہوتی ہے۔", roman: "Har rider ki pas manzar checking aur tasdeeq hoti hai." },
          },
          {
            icon: "lock",
            title: { en: "Secure Wallet", ur: "محفوظ والیٹ", roman: "Mehfooz wallet" },
            desc: { en: "Bank-grade security for all your earnings.", ur: "آپ کی تمام کمائی کے لیے بینک سطح کی سیکیورٹی۔", roman: "Aap ki tamam kamai ke liye bank satah ki security." },
          },
          {
            icon: "check",
            title: { en: "24/7 Support", ur: "24/7 سپورٹ", roman: "24/7 support" },
            desc: { en: "Our rider support team is always one tap away.", ur: "ہماری رائیڈر سپورٹ ٹیم ہمیشہ ایک ٹیپ کی دوری پر ہے۔", roman: "Hamari rider support team hamesha ek tap ki duri par hai." },
          },
        ]}
        ctaLoginLabel={{ en: "Login", ur: "لاگ ان", roman: "Login Karein" }}
        ctaRegisterLabel={{ en: "Join as Rider", ur: "رائیڈر بنیں", roman: "Rider Banein" }}
        supportPhone="+92-300-7654321"
        supportEmail="riders@ajkmart.com"
        footerLinks={[
          { label: { en: "Terms of Service", ur: "سروس کی شرائط", roman: "Service ki sharait" }, href: "#terms" },
          { label: { en: "Privacy Policy", ur: "رازداری کی پالیسی", roman: "Razdari ki policy" }, href: "#privacy" },
          { label: { en: "Rider Guidelines", ur: "رائیڈر رہنما اصول", roman: "Rider rehnuma usool" }, href: "#guidelines" },
        ]}
        onLogin={() => navigate("/login")}
        onRegister={() => navigate("/register")}
      />
  );
}

export default GuestLanding;
