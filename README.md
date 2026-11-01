# نبض الأسواق — لوحة حية (مجانية)

لوحة عربية RTL بتصميم نيون داكن + PWA.

## التحديثات الحية (بدون مفتاح API)
| القسم | المصدر | السرعة |
|---|---|---|
| بتكوين / إيثيريوم / ذهب PAXG | Binance WebSocket | شبه فوري (كسور الثانية) |
| العملات | open.er-api.com | ~كل دقيقة |
| أخبار / خريطة تقريبية | rss2json + Google News / Bloomberg | ~5 دقائق |
| نفط WTI / أسهم أمريكية | Yahoo عبر GitHub Actions → bake-*.json | ~كل 10 دقائق |
| مؤشرات / تقويم | World Bank + BIS + Forex Factory mirror عبر Actions | ~كل 10 دقائق |

## GitHub Pages
Settings → Pages → Deploy from branch `main` / root.

للعرض فقط — ليست توصيات تداول.
