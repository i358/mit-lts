import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Geri Dön
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Gizlilik Politikası</h1>
          <p className="text-gray-600">Son güncelleme: {new Date().getFullYear()}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
          {/* Section 1: Introduction */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">1. Giriş</h2>
            <p className="text-gray-700 leading-relaxed">
              habbojoh.com.tr ("Platform") kullanıcılarının gizliliğini önemsemektedir. Bu Gizlilik Politikası, 
              platformunuzun veri işleme uygulamalarını ve koruma önlemlerini açıklamaktadır.
            </p>
          </section>

          {/* Section 2: Token and Cookies */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">2. Çerezler ve Token Depolama</h2>
            <div className="bg-gray-50 border-l-4 border-blue-500 p-4 space-y-3">
              <p className="text-gray-700">
                <strong>Amaç:</strong> Platformda oturumunuzu sürdürmek ve kimlik doğrulaması yapmak için 
                çerezleri ve belirteçleri (token) depolarız.
              </p>
              <p className="text-gray-700">
                <strong>Depolanan Veriler:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
                <li>Oturum kimliği (Session Token)</li>
                <li>Kullanıcı kimlik doğrulama belirteci (JWT Token)</li>
                <li>Tercihler ve ayarlar</li>
              </ul>
              <p className="text-gray-700 text-sm italic">
                Bu veriler yalnızca platformun işlevselliğini sağlamak için kullanılır ve üçüncü taraflarla 
                paylaşılmaz.
              </p>
            </div>
          </section>

          {/* Section 3: IP Address */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">3. IP Adresi Depolama</h2>
            <div className="bg-gray-50 border-l-4 border-green-500 p-4 space-y-3">
              <p className="text-gray-700">
                <strong>Amaç:</strong> Güvenlik ve hizmet kalitesini sağlamak için IP adreslerinizi depolarız.
              </p>
              <p className="text-gray-700">
                <strong>Kullanım Alanları:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
                <li><strong>Hız Sınırlaması (Rate Limiting):</strong> Kötüye kullanımı önlemek</li>
                <li><strong>Yasaklı Hesap Denetimi:</strong> Yasaklı kullanıcıları algılamak</li>
                <li><strong>Yan Hesap Tespiti:</strong> Kural ihlali yapan hesapları belirlemek</li>
                <li><strong>Güvenlik:</strong> Şüpheli aktiviteleri izlemek</li>
              </ul>
              <p className="text-gray-700 text-sm italic">
                IP adresleri yalnızca bu amaçlarla kullanılır ve başka hiçbir şirketle paylaşılmaz.
              </p>
            </div>
          </section>

          {/* Section 4: Password Security */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">4. Şifre Güvenliği</h2>
            <div className="bg-gray-50 border-l-4 border-purple-500 p-4 space-y-3">
              <p className="text-gray-700">
                <strong>Şifre Depolama:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
                <li>Şifreler <strong>asla</strong> açık metin olarak depolanmaz</li>
                <li>Şifreler <strong>AES-256 şifreleme</strong> ile güvenli bir şekilde şifrelenerek saklanır</li>
                <li>Her şifre <strong>HMAC-SHA256</strong> ile doğrulanır</li>
                <li>Şifrelerin doğruluğu veritabanında saklanan HMAC değeriyle kontrol edilir</li>
              </ul>
              <p className="text-gray-700">
                <strong>Güvenlik Garantisi:</strong> Şifreler o kadar güvenli bir şekilde şifrelenerek saklanır ki, 
                platform yöneticileri ve veritabanı yöneticileri dahi şifrenizin ne olduğunu bilemezler.
              </p>
              <p className="text-gray-700 text-sm italic">
                Şifrenizin guvenliği bizim için en yüksek öncelik ve siz dışında kimse onu öğrenemez.
              </p>
            </div>
          </section>

          {/* Section 5: Data Sharing */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">5. Veri Paylaşımı</h2>
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <p className="text-gray-900 font-semibold mb-2">❌ Hiçbir Üçüncü Taraf Paylaşımı</p>
              <p className="text-gray-700">
                Toplanan hiçbir kişisel veri (IP adresleri, şifreler, token'lar vb.) 
                <strong className="block mt-2"> üçüncü taraf şirketleri, reklam ağları veya analitik hizmetleriyle 
                paylaşılmaz.</strong>
              </p>
              <p className="text-gray-700 mt-3">
                Verileriniz yalnızca habbojoh.com.tr tarafından korunur ve sadece platform hizmetlerini 
                sağlamak için kullanılır.
              </p>
            </div>
          </section>

          {/* Section 6: Your Rights */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">6. Haklarınız</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span>Verilerinize erişim ve bunları inceleme hakkı</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span>Verilerinizi düzeltme veya silme talebinde bulunma hakkı</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span>Veri işlemenin sınırlandırılmasını talep etme hakkı</span>
              </li>
            </ul>
            <p className="text-gray-600 text-sm">
              Bu haklarınızı kullanmak için platformda hesap ayarlarınızdan ya da 
              support@habbojoh.com.tr adresinden bize ulaşabilirsiniz.
            </p>
          </section>

          {/* Section 7: Contact */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">7. İletişim</h2>
            <p className="text-gray-700">
              Gizlilik politikamız hakkında soruların varsa veya haklarınızı kullanmak istiyorsanız, 
              lütfen bize ulaşın:
            </p>
            <div className="bg-gray-100 p-4 rounded border border-gray-300">
              <p className="text-gray-900">
                <strong>E-posta:</strong> privacy@habbojoh.com.tr
              </p>
              <p className="text-gray-900 mt-2">
                <strong>Web:</strong> www.habbojoh.com.tr
              </p>
            </div>
          </section>

          {/* Footer Note */}
          <div className="border-t border-gray-200 pt-8">
            <p className="text-gray-600 text-sm">
              Bu Gizlilik Politikası herhangi bir zamanda güncellenebilir. Önemli değişiklikler yaptığımızda, 
              platformda bir bildiri gösterilecektir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
