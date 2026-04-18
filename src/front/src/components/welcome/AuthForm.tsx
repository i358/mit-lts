import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { User, Lock, LogIn, UserPlus, Users, Shield, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { AuthService } from '../../services/auth.service';
import { mitAPI } from '../../services/api';

import toast from 'react-hot-toast';
import axios from 'axios';

interface AuthFormProps {
  type: 'login' | 'register';
  onSubmit: (data: any) => void;
  onToggle: () => void;
}

type LoginStep = 'form' | 'forgot-password-username' | 'forgot-password-verify' | 'forgot-password-set';

export function AuthForm({ type, onSubmit, onToggle }: AuthFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    habboUsername: '',
    verificationCode: '',
    password: '',
    confirmPassword: ''
  });
  const [stateId, setStateId] = useState<number | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [currentMotto, setCurrentMotto] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'checking' | 'success' | 'failed'>('idle');

  // Login form data
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  // Forgot password states
  const [forgotPasswordStep, setForgotPasswordStep] = useState<LoginStep>('form');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotVerificationCode, setForgotVerificationCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotStateId, setForgotStateId] = useState<string | null>(null);



  const handleStep1Submit = async () => {
    if (!formData.habboUsername.trim()) {
      setErrors({ habboUsername: 'Habbo kullanıcı adı zorunludur' });
      return;
    }

    setLoading(true);
    try {
      const response = await AuthService.checkUsername(formData.habboUsername);
      if (response.success) {
        setStateId(response.state_id);
        setGeneratedCode(response.verification_code);
        setCurrentStep(2);
        setErrors({});
        toast.success('Şimdi doğrulama kodunu mottona ekle.');
        const userResponse = await axios.get("https://www.habbo.com.tr/api/public/users?name=" + formData.habboUsername);
        setCurrentMotto(userResponse.data.motto); 
      }
    } catch (error: any) {
      setErrors({ habboUsername: error.message });
      toast.error(error.message);
    }
    setLoading(false);
  };

  const handleVerification = async () => {
    if (!stateId) {
      toast.error('Geçersiz durum. Lütfen tekrar deneyin.');
      return;
    }

    setLoading(true);
    setVerificationStatus('checking');
    
    try {
      await AuthService.verifyMotto(stateId);
      setVerificationStatus('success');
      setCurrentStep(3);
      setErrors({});
      toast.success('Doğrulama başarılı! Şimdi şifreni belirle.');
    } catch (error: any) {
      setVerificationStatus('failed');
      setErrors({ verification: error.message });
      toast.error('Doğrulama başarısız: ' + error.message);
    }
    
    setLoading(false);
  };

  const handleFinalSubmit = async () => {
    if (!stateId) {
      toast.error('Geçersiz durum. Lütfen tekrar deneyin.');
      return;
    }

    const newErrors: Record<string, string> = {};

    if (!formData.password.trim()) newErrors.password = 'Şifre zorunludur';
    if (formData.password.length < 6) newErrors.password = 'Şifre en az 6 karakter olmalıdır';
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Şifreler uyuşmuyor';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setLoading(true);
      try {
        await AuthService.completeRegistration(stateId, formData.password);
        
        toast.success('Kayıt başarılı! Şimdi giriş yapabilirsin.');
        onToggle();
      } catch (error: any) {
        toast.error(error.message);
      }
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const newErrors: Record<string, string> = {};
    if (!loginData.username.trim()) newErrors.username = 'Kullanıcı adı zorunludur';
    if (!loginData.password.trim()) newErrors.password = 'Şifre zorunludur';

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      try {
        // Login işlemi
        const loginResponse = await AuthService.login(loginData.username, loginData.password);
        
        // Ban kontrolü
        if (loginResponse.banned) {
          const banUserData = {
            id: loginResponse.ban_info.user_id,
            username: loginResponse.ban_info.username,
            is_banned: true,
            ban_info: {
              ...loginResponse.ban_info,
              id: Number(loginResponse.ban_info.id),
              permanent: loginResponse.ban_info.permanently || false
            }
          };
          onSubmit(banUserData);
          setLoading(false);
          return;
        }

        // Otomatik oluşturulmuş hesap kontrolü
        if (loginResponse.auto_generated_account) {
          toast.error(loginResponse.error);
          setForgotUsername(loginData.username);
          setLoading(false);
          
          // 2 saniye sonra şifre sıfırlama formunu otomatik aç
          setTimeout(() => {
            setForgotPasswordStep('forgot-password-username');
          }, 2000);
          return;
        }

        if (loginResponse.success === 1) {
          // Login başarılıysa kullanıcı bilgilerini al
          const userResponse = await AuthService.getCurrentUser();
          if (userResponse?.success === 1 && userResponse.user) {
            onSubmit(userResponse.user);
            toast.success('Başarıyla giriş yapıldı!');
          }
        } else {
          toast.error(loginResponse.error || 'Giriş başarısız');
        }
      } catch (error: any) {
        toast.error(error.message);
      }
    }
    setLoading(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    toast.success('Kod panoya kopyalandı!');
  };

  // Forgot password handlers - Step 1: Username
  const handleForgotPasswordUsername = async () => {
    if (!forgotUsername.trim()) {
      toast.error('Kullanıcı adı girin');
      return;
    }

    setLoading(true);
    try {
      const response = await mitAPI.verifyMotto(forgotUsername, 'forgot');
      if (response.success === 1) {
        setForgotStateId(response.state_id);
        setForgotVerificationCode(response.verification_code);
        setForgotPasswordStep('forgot-password-verify');
        toast.success(`Doğrulama kodu: ${response.verification_code}`);
      } else {
        toast.error(response.error || 'Hata oluştu');
      }
    } catch (error: any) {
      toast.error(error.message || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify motto
  const handleForgotPasswordVerify = async (stateId: string | null = null) => {
    const targetStateId = stateId || forgotStateId;
    if (!targetStateId) {
      toast.error('State bulunamadı');
      return;
    }

    setLoading(true);
    try {
      const response = await mitAPI.verifyMottoCheck(targetStateId);
      if (response.success === 1) {
        setForgotPasswordStep('forgot-password-set');
        toast.success('Motto doğrulandı!');
      } else {
        toast.error(response.error || 'Motto doğrulaması başarısız. Kodu motto\'nuza yazıp tekrar deneyin.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleForgotPasswordSet = async () => {
    if (!forgotNewPassword || !forgotConfirmPassword) {
      toast.error('Şifreler boş bırakılamaz');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }

    if (forgotNewPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (!forgotStateId) {
      toast.error('State ID bulunamadı');
      return;
    }

    setLoading(true);
    try {
      const response = await mitAPI.forgotPassword(forgotStateId, forgotNewPassword);
      if (response.success === 1) {
        toast.success('Şifreniz başarıyla sıfırlandı! Şimdi giriş yapabilirsiniz.');
        setForgotPasswordStep('form');
        setForgotUsername('');
        setForgotVerificationCode('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotStateId(null);
      } else {
        toast.error(response.error || 'Hata oluştu');
      }
    } catch (error: any) {
      toast.error(error.message || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setForgotPasswordStep('form');
    setForgotUsername('');
    setForgotVerificationCode('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotStateId(null);
  };

  const updateField = (field: string, value: string) => {
    if (type === 'login') {
      setLoginData(prev => ({ ...prev, [field]: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (type === 'login') {
    // Forgot password view
    if (forgotPasswordStep !== 'form') {
      // Hangi adımda olduğumuzu belirle
      let forgotPasswordStepNumber = 1;
      if (forgotPasswordStep === 'forgot-password-verify') forgotPasswordStepNumber = 2;
      else if (forgotPasswordStep === 'forgot-password-set') forgotPasswordStepNumber = 3;

      return (
        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                  ${forgotPasswordStepNumber >= step 
                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {forgotPasswordStepNumber > step ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                {step < 3 && (
                  <div className={`
                    w-12 h-1 mx-2
                    ${forgotPasswordStepNumber > step ? 'bg-gradient-to-r from-primary-500 to-accent-500' : 'bg-gray-200'}
                  `} />
                )}
              </React.Fragment>
            ))}
          </div>
          {forgotPasswordStep === 'forgot-password-username' && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Şifremi Unuttum</h3>
                <p className="text-gray-600">Şifrenizi sıfırlamak için Habbo kullanıcı adınızı girin</p>
              </div>

              <div className="space-y-4">
                <Input
                  label="Habbo Kullanıcı Adı"
                  placeholder="Habbo kullanıcı adınız"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  icon={Users}
                  fullWidth
                />
                <Button
                  onClick={handleForgotPasswordUsername}
                  loading={loading}
                  fullWidth
                  className="bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 py-4"
                >
                  {loading ? 'Hazırlanıyor...' : 'Devam Et'}
                </Button>
                <Button
                  onClick={() => {
                    setForgotPasswordStep('form');
                    setForgotUsername('');
                    setForgotVerificationCode('');
                    setForgotNewPassword('');
                    setForgotConfirmPassword('');
                    setForgotStateId(null);
                  }}
                  variant="ghost"
                  fullWidth
                  className="text-gray-600 hover:text-gray-700"
                >
                  Geri Dön
                </Button>
              </div>
            </>
          )}

          {forgotPasswordStep === 'forgot-password-verify' && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Doğrulama</h3>
                <p className="text-gray-600">Aşağıdaki kodu Habbo mottona ekle</p>
              </div>

              <div className="bg-gradient-to-r from-gray-800/30 to-gray-700/30 border-2 border-gray-600/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Doğrulama Kodu:</span>
                  <Button
                    onClick={() => {
                      if (forgotVerificationCode) {
                        navigator.clipboard.writeText(forgotVerificationCode);
                        toast.success('Kod panoya kopyalandı!');
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    icon={Copy}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    Kopyala
                  </Button>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border-2 border-dashed border-gray-600">
                  <code className="text-2xl font-bold text-gray-300 block text-center">
                    {forgotVerificationCode || '...'}
                  </code>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
                  Bu kodu Habbo profilindeki mottona ekle ve "Doğrula" butonuna bas
                </p>
              </div>

              <Button
                onClick={() => handleForgotPasswordVerify()}
                loading={loading}
                fullWidth
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 py-4 text-lg"
              >
                {loading ? 'Doğrulanıyor...' : 'Doğrula'}
              </Button>

              <Button
                onClick={() => {
                  setForgotUsername('');
                  setForgotVerificationCode('');
                  setForgotStateId(null);
                  setForgotPasswordStep('forgot-password-username');
                }}
                variant="ghost"
                fullWidth
                className="text-gray-600 hover:text-gray-700"
              >
                Baştan Başla
              </Button>
            </>
          )}

          {forgotPasswordStep === 'forgot-password-set' && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Yeni Şifre Belirle</h3>
                <p className="text-gray-600">Hesabınız için yeni bir şifre oluşturun</p>
              </div>

              <div className="space-y-4">
                <Input
                  label="Yeni Şifre"
                  type="password"
                  placeholder="Güvenli bir şifre gir"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  icon={Lock}
                  fullWidth
                />
                <Input
                  label="Şifre Tekrar"
                  type="password"
                  placeholder="Şifreyi tekrar gir"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  icon={Lock}
                  fullWidth
                />
                <Button
                  onClick={handleForgotPasswordSet}
                  loading={loading}
                  fullWidth
                  className="bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 py-4"
                >
                  {loading ? 'Sıfırlanıyor...' : 'Şifreyi Sıfırla'}
                </Button>
                <Button
                  onClick={() => {
                    setForgotPasswordStep('forgot-password-username');
                    setForgotNewPassword('');
                    setForgotConfirmPassword('');
                  }}
                  variant="ghost"
                  fullWidth
                  className="text-gray-600 hover:text-gray-700"
                >
                  İptal
                </Button>
              </div>
            </>
          )}
        </div>
      );
    }

    // Normal login form
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">JÖH'e Hoş Geldin!</h3>
          <p className="text-gray-600">Hesabına giriş yap ve maceraya devam et</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <Input
            label="Habbo Kullanıcı Adı"
            placeholder="Habbo kullanıcı adın"
            value={loginData.username}
            onChange={(e) => updateField('username', e.target.value)}
            error={errors.username}
            icon={Users}
            fullWidth
          />

          <Input
            label="Şifre"
            type="password"
            placeholder="Şifren"
            value={loginData.password}
            onChange={(e) => updateField('password', e.target.value)}
            error={errors.password}
            icon={Lock}
            fullWidth
          />

          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={loading}
            icon={LogIn}
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 py-4 text-lg"
          >
            Giriş Yap
          </Button>
        </form>

        <div className="text-center space-y-3">
          <p className="text-gray-600 text-sm">
            <button
              type="button"
              onClick={() => {
                setForgotPasswordStep('forgot-password-username');
                setForgotUsername('');
                setForgotVerificationCode('');
                setForgotNewPassword('');
                setForgotConfirmPassword('');
                setForgotStateId(null);
              }}
              className="text-gray-400 hover:text-gray-300 font-semibold"
            >
              Şifremi Unuttum?
            </button>
          </p>
          <p className="text-gray-600">
            Hesabın yok mu?
            {' '}
            <button
              type="button"
              onClick={onToggle}
              className="text-gray-400 hover:text-gray-300 font-semibold"
            >
              JÖH'e Katıl
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((step) => (
          <React.Fragment key={step}>
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
              ${currentStep >= step 
                ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg' 
                : 'bg-gray-200 text-gray-500'
              }
            `}>
              {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
            </div>
            {step < 3 && (
              <div className={`
                w-12 h-1 mx-2
                ${currentStep > step ? 'bg-gradient-to-r from-primary-500 to-accent-500' : 'bg-gray-200'}
              `} />
            )}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Habbo Username */}
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Habbo Kullanıcı Adın</h3>
              <p className="text-gray-600">JÖH'e katılmak için Habbo kullanıcı adını gir</p>
            </div>

            <Input
              label="Habbo Kullanıcı Adı"
              placeholder="Habbo'daki kullanıcı adın"
              value={formData.habboUsername}
              onChange={(e) => updateField('habboUsername', e.target.value)}
              error={errors.habboUsername}
              icon={Users}
              fullWidth
            />

            <Button
              onClick={handleStep1Submit}
              fullWidth
              loading={loading}
              disabled={loading}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 py-4 text-lg"
            >
              Devam Et
            </Button>
          </motion.div>
        )}

        {/* Step 2: Verification */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Doğrulama</h3>
              <p className="text-gray-600">Aşağıdaki kodu Habbo mottona ekle</p>
               <p className="text-gray-300 mt-[5px]">Mevcut mottonuz: {currentMotto}</p>
            </div>

            <div className="bg-gradient-to-r from-gray-800/30 to-gray-700/30 border-2 border-gray-600/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Doğrulama Kodu:</span>
                <Button
                  onClick={copyCode}
                  variant="ghost"
                  size="sm"
                  icon={Copy}
                  className="text-gray-400 hover:text-gray-300"
                >
                  Kopyala
                </Button>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border-2 border-dashed border-gray-600">
                <code className="text-2xl font-bold text-gray-300 block text-center">
                  {generatedCode}
                </code>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
                Bu kodu Habbo profilindeki mottona ekle ve "Doğrula" butonuna bas
              </p>
            </div>

            {errors.verification && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{errors.verification}</span>
              </div>
            )}

            <Button
              onClick={handleVerification}
              fullWidth
              loading={loading}
              disabled={loading}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 py-4 text-lg"
            >
              {verificationStatus === 'checking' ? 'Doğrulanıyor...' : 'Doğrula'}
            </Button>

            <Button
              onClick={() => setCurrentStep(1)}
              variant="ghost"
              fullWidth
              className="text-gray-600 hover:text-gray-700"
            >
              Geri Dön
            </Button>
          </motion.div>
        )}

        {/* Step 3: Password */}
        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Şifre Belirle</h3>
              <p className="text-gray-600">Hesabın için güvenli bir şifre oluştur</p>
            </div>

            <Input
              label="Şifre"
              type="password"
              placeholder="Güvenli bir şifre gir"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              error={errors.password}
              icon={Lock}
              fullWidth
            />

            <Input
              label="Şifre Tekrar"
              type="password"
              placeholder="Şifreni tekrar gir"
              value={formData.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              icon={Lock}
              fullWidth
            />

            <Button
              onClick={handleFinalSubmit}
              fullWidth
              loading={loading}
              disabled={loading}
              icon={UserPlus}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 py-4 text-lg"
            >
              JÖH'e Katıl
            </Button>

            <Button
              onClick={() => setCurrentStep(2)}
              variant="ghost"
              fullWidth
              className="text-gray-600 hover:text-gray-700"
            >
              Geri Dön
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center">
        <p className="text-gray-600">
          Zaten hesabın var mı?
          {' '}
          <button
            type="button"
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-300 font-semibold"
          >
            Giriş Yap
          </button>
        </p>
      </div>
    </div>
  );
}