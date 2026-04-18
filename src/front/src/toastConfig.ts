import { toast, ToastOptions } from 'react-hot-toast';

export const toastConfig: { success: ToastOptions; error: ToastOptions; rateLimit: ToastOptions } = {
  success: {
    style: {
      background: '#10391C',
      color: '#86EFAC',
      fontWeight: '500',
      border: '1px solid rgba(134, 239, 172, 0.2)',
    },
    iconTheme: {
      primary: '#86EFAC',
      secondary: '#10391C',
    },
  },
  error: {
    style: {
      background: '#391010',
      color: '#FECACA',
      fontWeight: '500',
      border: '1px solid rgba(254, 202, 202, 0.2)',
    },
    iconTheme: {
      primary: '#FECACA',
      secondary: '#391010',
    },
  },
  rateLimit: {
    style: {
      background: '#392810',
      color: '#FED7AA',
      fontWeight: '500',
      border: '1px solid rgba(254, 215, 170, 0.2)',
    },
    iconTheme: {
      primary: '#FED7AA',
      secondary: '#392810',
    },
    duration: 5000,
  },
};