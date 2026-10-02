import { useState } from 'react';
import { LockOutlined } from '@ant-design/icons';
import { JshshirInput, JSHSHIR_LENGTH } from '@/shared/ui';
import { appConfig } from '@/shared/config';
import { useAuth } from './use-auth';
import { AuthWrapper } from './login.styles';

const isDev = import.meta.env.DEV;
const DEV_DEFAULT_PIN = '00000000000001';

type Tab = 'oneid' | 'login';

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>(isDev ? 'oneid' : 'login');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const doLogin = async (value: string) => {
    if (value.length !== 14 || loading) return;
    setLoading(true);
    await login(value);
    setLoading(false);
  };

  return (
    <AuthWrapper>
      <div className="logo-section">
        <img src="/logo.png" alt="Logo" />
        <h2>{appConfig.appName}</h2>
      </div>

      <div className="login-card">
        <div className="login-card-title">Tizimga kirish</div>

        <div className="login-tabs" role="tablist" aria-label="Kirish usuli">
          {isDev ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'oneid'}
              className={`tab tab-oneid${tab === 'oneid' ? ' is-active' : ''}`}
              onClick={() => setTab('oneid')}
            >
              ONE <span className="id-badge">ID</span>
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={`tab tab-login${tab === 'login' ? ' is-active' : ''}`}
            onClick={() => setTab('login')}
          >
            Login
          </button>
        </div>

        <div className="login-card-bg">
          {isDev && tab === 'oneid' ? (
            <div className="tab-pane" key="oneid">
              <div className="card-bg-title">ONE ID orqali tizimga kiring</div>
              <div className="card-bg-desc">
                Yagona identifikatsiya tizimi (OneID) foydalanuvchining elektron
                hukumat va davlat organlarining turli axborot tizimlariga oddiy va
                xavfsiz kirishini ta&rsquo;minlash uchun mo&lsquo;ljallangan.
              </div>
              <button
                type="button"
                className="login-btn"
                disabled={loading}
                onClick={() => void doLogin(DEV_DEFAULT_PIN)}
              >
                {loading ? 'Kirilmoqda…' : 'ONE ID orqali tizimga kiring'}
              </button>
            </div>
          ) : (
            <div className="tab-pane" key="login">
              <div className="card-bg-title">ID raqami bilan kiring</div>
              <div className="card-bg-desc">
                14 xonali identifikatsiya raqamingizni kiriting.
              </div>
              <JshshirInput
                size="large"
                prefix={<LockOutlined />}
                value={pin}
                autoFocus
                onChange={setPin}
                onPressEnter={() => void doLogin(pin)}
              />
              <button
                type="button"
                className="login-btn"
                disabled={loading || pin.length !== JSHSHIR_LENGTH}
                onClick={() => void doLogin(pin)}
              >
                {loading ? 'Kirilmoqda…' : 'Tasdiqlash'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AuthWrapper>
  );
}
