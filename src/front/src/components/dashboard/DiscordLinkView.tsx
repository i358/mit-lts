import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MessageSquare as Discord, CheckCircle2, ChevronDown, Key, Settings, Lock } from 'lucide-react';
import { mitAPI } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';

type PasswordResetStep = 'initial' | 'verifying' | 'setting';

interface DiscordLinkViewProps {
    codeOnly?: boolean;
    onCodeSet?: () => void;
}

export function DiscordLinkView({ codeOnly = false, onCodeSet }: DiscordLinkViewProps) {
    const { user, setUser } = useAppStore();
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLinked, setIsLinked] = useState(false);
    const [discordUser, setDiscordUser] = useState<any>(null);
    const [codeValue, setCodeValue] = useState('');
    const [codeLoading, setCodeLoading] = useState(false);
    const [userCode, setUserCode] = useState<any>(null);
    const [codeSectionLoading, setCodeSectionLoading] = useState(true);
    const [expandedSection, setExpandedSection] = useState<'discord' | 'code' | 'password' | null>(codeOnly ? 'code' : 'discord');

    // Password reset states
    const [resetStep, setResetStep] = useState<PasswordResetStep>('initial');
    const [resetVerificationCode, setResetVerificationCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetStateId, setResetStateId] = useState<number | null>(null);

    useEffect(() => {
        const checkDiscordLink = async () => {
            try {
                const response = await mitAPI.checkDiscordLink();
                setIsLinked(response.isLinked);
                if (response.isLinked && response.discordUser) {
                    setDiscordUser(response.discordUser);
                    // toast.success('Discord hesabınız zaten bağlı!');
                }
            } catch (error: any) {
                console.error('Discord link check error:', error);
            }
        };

        const fetchUserCode = async () => {
            try {
                const response = await mitAPI.getUserCode();
                if (response.data) {
                    setUserCode(response.data);
                }
            } catch (error: any) {
                console.error('Kod bilgisi alınamadı:', error);
            } finally {
                setCodeSectionLoading(false);
            }
        };

        if (!codeOnly) {
            checkDiscordLink();
        }
        fetchUserCode();
    }, [codeOnly]);

    const handleSubmit = async () => {
        if (!verificationCode) {
            toast.error('Lütfen doğrulama kodunu girin');
            return;
        }

        setLoading(true);
        try {
            const response = await mitAPI.verifyDiscord(verificationCode);

            if (response.success === 1) {
                toast.success('Discord hesabınız başarıyla bağlandı!');
                setVerificationCode('');
                setIsLinked(true);
            } else {
                toast.error(response.error || 'Bir hata oluştu');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleSetCode = async () => {
        if (!codeValue.trim()) {
            toast.error('Lütfen bir kod girin');
            return;
        }

        // Kod formatını kontrol et
        if (!/^[a-zA-Z0-9]{1,}$/.test(codeValue.trim())) {
            toast.error('Kod sadece harf ve rakam içerebilir!');
            return;
        }

        setCodeLoading(true);
        try {
            const response = await mitAPI.setUserCode(codeValue.trim());
            
            if (response.success || response.message) {
                toast.success('Kodunuz başarıyla ayarlandı!');
                setUserCode({ codename: codeValue.trim() });
                if (user) {
                    setUser({
                        ...user,
                        hasCodeName: true
                    });
                }
                setCodeValue('');
                onCodeSet?.();
            } else {
                toast.error(response.error || 'Bir hata oluştu');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Bir hata oluştu');
        } finally {
            setCodeLoading(false);
        }
    };

    // Password reset handlers
    const handleStartPasswordReset = async () => {
        if (!user?.username) {
            toast.error('Kullanıcı bilgisi bulunamadı');
            return;
        }

        setResetLoading(true);
        try {
            const response = await mitAPI.verifyMotto(user.username, 'reset');
            if (response.success === 1) {
                setResetStateId(response.state_id);
                setResetVerificationCode(response.verification_code);
                setResetStep('verifying');
                toast.success(`Doğrulama kodu: ${response.verification_code}`);
                
                // Otomatik olarak motto doğrulamasını başlat
                // Kullanıcının motto'ya kodu yazmasını beklemek için 2 saniye bekle
                setTimeout(() => {
                    handleVerifyMottoForReset(response.state_id);
                }, 2000);
            } else {
                toast.error(response.error || 'Hata oluştu');
            }
        } catch (error: any) {
            toast.error(error.message || 'Hata oluştu');
        } finally {
            setResetLoading(false);
        }
    };

    const handleVerifyMottoForReset = async (stateId: number | null = null) => {
        const targetStateId = stateId || resetStateId;
        if (!targetStateId) {
            toast.error('State bulunamadı');
            return;
        }

        setResetLoading(true);
        try {
            const response = await mitAPI.verifyMottoCheck(targetStateId);
            if (response.success === 1) {
                setResetStep('setting');
                toast.success('Motto doğrulandı!');
            } else {
                toast.error(response.error || 'Motto doğrulaması başarısız. Kodu motto\'nuza yazıp tekrar deneyin.');
            }
        } catch (error: any) {
            toast.error(error.message || 'Hata oluştu');
        } finally {
            setResetLoading(false);
        }
    };

    const handleConfirmNewPassword = async () => {
        if (!newPassword || !confirmPassword) {
            toast.error('Şifreler boş bırakılamaz');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Şifreler eşleşmiyor');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('Şifre en az 6 karakter olmalıdır');
            return;
        }

        if (!resetStateId) {
            toast.error('State ID bulunamadı');
            return;
        }

        setResetLoading(true);
        try {
            const response = await mitAPI.resetPassword(resetStateId, newPassword);
            if (response.success === 1) {
                toast.success('Şifreniz başarıyla sıfırlandı!');
                setResetStep('initial');
                setResetVerificationCode('');
                setNewPassword('');
                setConfirmPassword('');
                setResetStateId(null);
                setExpandedSection(null);
            } else {
                toast.error(response.error || 'Hata oluştu');
            }
        } catch (error: any) {
            toast.error(error.message || 'Hata oluştu');
        } finally {
            setResetLoading(false);
        }
    };

    const resetPasswordReset = () => {
        setResetStep('initial');
        setResetVerificationCode('');
        setNewPassword('');
        setConfirmPassword('');
        setResetStateId(null);
    };

    const headerTitle = codeOnly ? 'Terfi Kodu Ayarlama' : 'Kullanıcı Ayarları';
    const headerDescription = codeOnly
        ? 'Devam edebilmek için terfi kodunu ayarlamalısın'
        : 'Hesabınızı yönetin ve terfi kodunuzu ayarlayın';

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            {/* Settings Header */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center">
                        <Settings className="w-5 h-5 text-gray-300" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">{headerTitle}</h1>
                </div>
                <p className="text-gray-400 ml-13">{headerDescription}</p>
            </div>

            {/* Discord Section */}
            {!codeOnly && (
            <div className="group">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'discord' ? null : 'discord')}
                    className="w-full px-6 py-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl transition-all duration-300 flex items-center justify-between"
                >
                    <div className="flex items-center space-x-4 text-left">
                        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-gray-600 transition-colors">
                            <Discord className="w-5 h-5 text-gray-300" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Discord Bağlantısı</h3>
                            <p className="text-sm text-gray-400 mt-0.5">
                                {isLinked ? `${discordUser?.username || 'Bağlı'} hesabında bağlı` : 'Henüz bağlanmamış'}
                            </p>
                        </div>
                    </div>
                    <ChevronDown 
                        className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
                            expandedSection === 'discord' ? 'rotate-180' : ''
                        }`}
                    />
                </button>

                {expandedSection === 'discord' && (
                    <div className="mt-2 p-6 bg-gray-900/50 rounded-xl border border-gray-800 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {!isLinked ? (
                            <>
                                <div className="space-y-4">
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mt-0.5">
                                            <span className="text-xs font-semibold text-gray-300">1</span>
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">Discord sunucusunda komut çalıştırın</p>
                                            <code className="inline-block mt-2 px-3 py-2 bg-gray-800 rounded text-gray-300 text-sm">/link</code>
                                        </div>
                                    </div>
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mt-0.5">
                                            <span className="text-xs font-semibold text-gray-300">2</span>
                                        </div>
                                        <p className="text-gray-300">Bot tarafından size gönderilen doğrulama kodunu alın</p>
                                    </div>
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mt-0.5">
                                            <span className="text-xs font-semibold text-gray-300">3</span>
                                        </div>
                                        <p className="text-gray-300">Aşağıda kodu girin ve doğrulayın</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Input
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                                        placeholder="Doğrulama kodunuzu yazın..."
                                        className="text-center tracking-widest text-lg"
                                        maxLength={8}
                                    />
                                    <Button 
                                        onClick={handleSubmit}
                                        loading={loading}
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                    >
                                        {loading ? 'Doğrulanıyor...' : 'Doğrula ve Bağla'}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-green-400 font-semibold">Başarıyla bağlandı</p>
                                        {discordUser && (
                                            <p className="text-sm text-gray-300 mt-1 flex items-center space-x-2">
                                                {discordUser.avatar && (
                                                    <img 
                                                        src={discordUser.avatar} 
                                                        alt="Discord Avatar" 
                                                        className="w-5 h-5 rounded-full"
                                                    />
                                                )}
                                                <span>{discordUser.username}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <p className="text-gray-400 text-sm">
                                    Discord hesabınız başarıyla bağlandı. JÖH bot komutlarını kullanabilirsiniz.
                                </p>
                                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                                    <p className="text-xs text-gray-400">
                                        Bağlantıyı kaldırmak için Discord sunucusunda <code className="text-red-400">/unlink</code> komutunu kullanın.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            )}
            {/* Code Section */}
            <div className="group">
                <button
                    onClick={() => {
                        if (codeOnly) return;
                        setExpandedSection(expandedSection === 'code' ? null : 'code');
                    }}
                    className="w-full px-6 py-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl transition-all duration-300 flex items-center justify-between"
                >
                    <div className="flex items-center space-x-4 text-left">
                        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-gray-600 transition-colors">
                            <Key className="w-5 h-5 text-gray-300" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Terfi Kodu</h3>
                            <p className="text-sm text-gray-400 mt-0.5">
                                {userCode ? `Kodunuz: ${userCode.codename}` : 'Henüz kod ayarlanmamış'}
                            </p>
                        </div>
                    </div>
                    <ChevronDown 
                        className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
                            expandedSection === 'code' ? 'rotate-180' : ''
                        }`}
                    />
                </button>

                {(expandedSection === 'code' || codeOnly) && !codeSectionLoading && (
                    <div className="mt-2 p-6 bg-gray-900/50 rounded-xl border border-gray-800 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                        {userCode && (
                            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                                <p className="text-xs text-gray-400 tracking-wide mb-2">Mevcut Kodunuz</p>
                                <code className="text-2xl font-bold text-gray-200 tracking-wider">
                                    {userCode.codename}
                                </code>
                            </div>
                        )}

                        <div className="space-y-3">
                            <label className="block">
                                <span className="text-sm font-medium text-gray-300 mb-2 block">
                                    {userCode ? 'Yeni Kod Ayarla' : 'Kod Belirle'}
                                </span>
                                <div className="flex space-x-2">
                                    <Input
                                        value={codeValue}
                                        onChange={(e) => setCodeValue(e.target.value)}
                                        placeholder={userCode ? "Yeni kod girin..." : "Terfi kodunuzu belirleyin..."}
                                        className="flex-1 tracking-wide"
                                        maxLength={6}
                                    />
                                    <Button 
                                        onClick={handleSetCode}
                                        loading={codeLoading}
                                        className="bg-red-600 hover:bg-red-700 whitespace-nowrap"
                                    >
                                        {codeLoading ? '...' : (userCode ? 'Değiştir' : 'Ayarla')}
                                    </Button>
                                </div>
                            </label>
                            <p className="text-xs text-gray-500 flex items-center space-x-1">
                                <span>💡</span>
                                <span>Harf ve rakam içerebilir, terfi işlemlerinde kullanılır</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Password Reset Section */}
            {!codeOnly && (
            <div className="group">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'password' ? null : 'password')}
                    className="w-full px-6 py-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl transition-all duration-300 flex items-center justify-between"
                >
                    <div className="flex items-center space-x-4 text-left">
                        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-gray-600 transition-colors">
                            <Lock className="w-5 h-5 text-gray-300" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Şifre Sıfırlama</h3>
                            <p className="text-sm text-gray-400 mt-0.5">Hesap şifrenizi değiştirin</p>
                        </div>
                    </div>
                    <ChevronDown 
                        className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
                            expandedSection === 'password' ? 'rotate-180' : ''
                        }`}
                    />
                </button>

                {expandedSection === 'password' && (
                    <div className="mt-2 p-6 bg-gray-900/50 rounded-xl border border-gray-800 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {resetStep === 'initial' && (
                            <div className="space-y-4">
                                <p className="text-gray-300 text-sm">
                                    Şifre sıfırlama işlemini başlatmak için aşağıdaki düğmeye tıklayın. Size bir doğrulama kodu gönderilecektir.
                                </p>
                                <Button
                                    onClick={handleStartPasswordReset}
                                    loading={resetLoading}
                                    className="w-full bg-yellow-600 hover:bg-yellow-700"
                                >
                                    {resetLoading ? 'Hazırlanıyor...' : 'Şifre Sıfırlamayı Başlat'}
                                </Button>
                            </div>
                        )}

                        {resetStep === 'verifying' && (
                            <div className="space-y-4">
                                <div className="bg-blue-950 border border-blue-800 rounded-lg p-4">
                                    <p className="text-sm font-semibold text-blue-300 mb-2">Doğrulama Kodu:</p>
                                    <div className="bg-gray-900 p-3 rounded text-center font-mono text-lg font-bold text-blue-400 tracking-wider">
                                        {resetVerificationCode || '...'}
                                    </div>
                                    <p className="text-xs text-blue-400 mt-2 text-center">
                                        Lütfen bu kodu Habbo hesabınızın mottosuna yazın
                                    </p>
                                </div>

                                <div className="bg-amber-950 border border-amber-800 rounded-lg p-4">
                                    <p className="text-sm text-amber-400 flex items-center gap-2">
                                        <span className="inline-block animate-spin">⏳</span>
                                        Motto kontrol ediliyor...
                                    </p>
                                </div>

                                <div className="flex space-x-2">
                                    <Button
                                        onClick={() => handleVerifyMottoForReset()}
                                        loading={resetLoading}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        {resetLoading ? 'Kontrol Ediliyor...' : 'Manuel Kontrol'}
                                    </Button>
                                    <Button
                                        onClick={resetPasswordReset}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600"
                                    >
                                        İptal
                                    </Button>
                                </div>
                            </div>
                        )}

                        {resetStep === 'setting' && (
                            <div className="space-y-4">
                                <p className="text-gray-300 text-sm">
                                    Motto doğrulandı! Lütfen yeni şifrenizi belirleyin.
                                </p>
                                <div className="space-y-3">
                                    <Input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Yeni şifre..."
                                        className="w-full"
                                    />
                                    <Input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Şifreyi onayla..."
                                        className="w-full"
                                    />
                                    <div className="flex space-x-2">
                                        <Button
                                            onClick={handleConfirmNewPassword}
                                            loading={resetLoading}
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                        >
                                            Şifreyi Sıfırla
                                        </Button>
                                        <Button
                                            onClick={resetPasswordReset}
                                            className="flex-1 bg-gray-700 hover:bg-gray-600"
                                        >
                                            İptal
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            )}
        </div>
    );
}