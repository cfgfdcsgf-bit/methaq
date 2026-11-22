# Sources for external visual assets

## خط عناوين مِيثَاق

- [Aref Ruqaa](https://github.com/google/fonts/tree/main/ofl/arefruqaa)، نسختا Regular وBold، بترخيص SIL Open Font License 1.1 المرفق في `client/public/fonts/ArefRuqaa-OFL.txt`.

## مرجع واجهة ميثاق

- `reference-refraction.png` — خريطة إزاحة هندسية لتأثير انكسار الزجاج في أدوات التنقّل.

## المشاهد التفاعلية

- `meethaq-courtyard.jpg` و`meethaq-arcade.jpg` — ImageGen. ساحة مسجد خيالي ورواق معماري، من دون نصوص أو أشخاص.
- `meethaq-mushaf-real.jpg` — ImageGen. صورة توضيحية واقعية لغلاف مصحف مغلق وحامل خشبي. نص القراءة يأتي من بيانات المصحف المستقلة.

## واجهة مِيثَاق الجديدة

- `client/public/images/meethaq-dusk.jpg` — ImageGen. مسجد خيالي عند الغروب، إضاءة ذهبية وسماء زمردية، وتكوين يترك اليمين للنص العربي.
- `client/public/images/meethaq-ward.jpg` — ImageGen. مصحف مغلق بغلاف زمردي على حامل خشبي، إضاءة جانبية دافئة، ومن دون حروف أو صفحات ظاهرة.

## Homepage 3D Quran model

The homepage embeds [Quran 3D Free](https://sketchfab.com/3d-models/quran-3d-free-63021dc03fa0409ca8392b1eddfcbf18), by Muhammed Reca Mermutluoğlu (`3drec`) on Sketchfab. The model page lists Creative Commons Attribution licensing. A visible compact credit is shown directly beneath the model.

The supplied `quran-3d-free.zip` also includes the model source (`assets/quran-3d/Quran_FBX.fbx`) and its high-resolution cover image (`client/public/models/quran/quran-cover.jpg`). The closed-cover texture is used in the Quran section. Keep the creator credit and CC BY 4.0 attribution with redistributed model assets.

## Quran reader page data and QCF4 glyph fonts

### صورة طبعة مصحف المدينة الافتراضية

- المصدر هو `standard1-quran.pdf` الذي أرسله صاحب المشروع. تحمل نسخة الوقف اسم مجمع الملك فهد لطباعة المصحف الشريف على صفحة حقوق الطبع وتنص على عدم البيع. يوضح المجمع [شروط الاستخدام الرقمي](https://qurancomplex.gov.sa/mushaf-printing) للنسخة التي يتيحها.
- يُحوّل `scripts/import-mushaf-print.py` صفحات الملف من 4 إلى 607، الموافقة لصفحات المصحف من 1 إلى 604، إلى صور WebP في `client/public/data/quran/print-be0091b2`. تُحفظ حدود الصفحات وألوانها وزخارفها. يتحقق البرنامج من بصمة SHA-256 للمصدر قبل الاستيراد.
- يولّد `scripts/map-mushaf-verses.py` ملف `ayah-regions.json` من صور الطبعة نفسها وبيانات ترتيب الآيات المحلية. يتطلب Pillow وNumPy وOpenCV للتحضير فقط. تتكون منطقة الآية من مستطيل لكل سطر تشغله، وتبقى النصوص والزخارف في الصور الأصلية.

### بيانات العرض السابق

The reader uses the QCF4 Madinah page map and glyphs from the `quran-qcf4` dataset. Page JSON tries the pinned `quran-qcf4@1.1.0` jsDelivr release first, then the dataset's GitHub raw mirror. The reader preloads nearby pages and their glyph fonts in the background, and checks each page verse-by-verse against the app's local Hafs dataset before display. The page artwork uses Meethaq's own frame and the decorative banner mask supplied in `mushaf_madinah_page.zip`.

The QCF4 repository states that page JSON is MIT-licensed and that its font files are separate from that license, are supplied solely for Quranic rendering, and may not be redistributed, modified, or used commercially without explicit permission. Font files are therefore loaded directly from the pinned CDN and are not copied into this repository or the build output. If the site becomes commercial, obtain written permission from the relevant font rights holders first.

- `client/public/adhan.mp3` — أذان بصوت عاصم جاويد، تسجيل ١٧ مايو ٢٠٢٤. المصدر: [Internet Archive](https://archive.org/details/icr-friday-prayer-2nd-adhan-17th-may-2024-9th-dhul-qadah-1445-by-asim-javed)، CC0 1.0. SHA-256: `6f3f71188ede37936062a72e15753bb997e72b659eb61cc69a68b3cbf654f55c`.

- `client/public/images/meethaq-dawn-hero.jpg` — صورة افتتاحية أصلية مولّدة بأداة ImageGen المدمجة ومضغوطة للاستخدام في الويب. طلب التوليد: Create a landscape editorial architectural photograph for the decorative hero of Meethaq, an Arabic daily worship and Quran app. Original visual, no app UI. A monumental, slightly pointed Islamic architectural arch and repeating carved ribs in deep emerald limestone, framing a tranquil pale golden dawn shining through an opening, fine real stone textures, soft haze and a single narrow luminous edge. Elegant high-end architectural photography, cinematic chiaroscuro, mostly deep jade and spruce green with restrained muted champagne accents. Composition: arch centered in the left half of the wide frame, right 45% is essentially dark green with subtly textured shadow as negative space for live right-to-left text; keep the center quiet, no bright elements on the right, dark edges. Responsive crop should still show the arch. Wide aspect about 2:1. No lettering, Arabic calligraphy, text, people, logos, UI, crescent symbols, minaret or book, and no watermarks.
# رحلة مِيثَاق

- `client/public/images/meethaq-journey.jpg` — خلفية أصلية مولَّدة بأداة ImageGen ومضغوطة للاستخدام في الويب. وصف التوليد: منظر ليلي زمردي، ودرب كهرماني متعرّج يصل إلى مبنى صغير ذي قبة بين الأشجار والجبال. مساحة داكنة مخصّصة للنص العربي وعناصر التفاعل.
# خطوط الواجهة المحلية

- ملفات Cairo وAmiri وNoto Naskh Arabic وReem Kufi في `client/public/fonts` من [مستودع Google Fonts الرسمي](https://github.com/google/fonts/tree/main/ofl). تُحفظ ملفات ترخيص SIL Open Font License إلى جوار كل عائلة.
