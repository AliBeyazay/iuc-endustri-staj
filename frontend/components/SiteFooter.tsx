export default function SiteFooter() {
  return (
    <footer className="bg-[#132843] text-[#f3ead1] border-t border-[#d8ad43]/20 dark:bg-[#060e1a] dark:border-[#d8ad43]/15">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-[1.7fr_0.9fr] md:px-8">
        <div>
          <h2 className="campus-heading text-[1.65rem] text-[#d8ad43]">{'\u0130leti\u015fim'}</h2>
          <div className="mt-3 space-y-2.5 text-sm leading-5.5 text-[#f7ecd0]/86">
            <p>
              <span className="font-semibold text-[#f3ead1]">{'Adres: '}</span>
              {
                '\u0130stanbul \u00dcniversitesi-Cerrahpa\u015fa M\u00fchendislik Fak\u00fcltesi End\u00fcstri M\u00fchendisli\u011fi B\u00f6l\u00fcm\u00fc, \u00dcniversite Mahallesi \u00dcniversite Caddesi No:7, 34320 Avc\u0131lar/\u0130stanbul'
              }
            </p>
            <p>
              <span className="font-semibold text-[#f3ead1]">{'B\u00f6l\u00fcm Telefonu: '}</span>
              {'+90 212 404 03 00 / 20204'}
            </p>
            <p>
              <span className="font-semibold text-[#f3ead1]">{'B\u00f6l\u00fcm E-postas\u0131: '}</span>
              <a className="text-[#edd089] hover:underline" href="mailto:endustri.muhendisligi@iuc.edu.tr">
                {'endustri.muhendisligi@iuc.edu.tr'}
              </a>
            </p>
          </div>
        </div>

        <div>
          <h2 className="campus-heading text-[1.65rem] text-[#d8ad43]">{'Ba\u011flant\u0131lar'}</h2>
          <div className="mt-3 space-y-2 text-sm text-[#f7ecd0]/86">
            <a
              className="block hover:text-[#edd089] hover:underline"
              href="https://endustrimuhendislik.iuc.edu.tr/tr/_"
              target="_blank"
              rel="noreferrer"
            >
              {'B\u00f6l\u00fcm Web Sitesi'}
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-2.5 text-center text-sm text-[#d8ad43] md:px-8">
        {
          '\u00a9 2026 Her hakk\u0131 \u0130stanbul \u00dcniversitesi-Cerrahpa\u015fa End\u00fcstri M\u00fchendisli\u011fine aittir.'
        }
      </div>
    </footer>
  )
}
