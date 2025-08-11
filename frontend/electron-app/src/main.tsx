import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
// 导入电子API模拟实现
import './electron-mock';
import App from './App';
import './styles/index.css';
import { AppProvider } from './context/AppContext';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from './store';
// 导入完整的主题系统
import { darkTheme } from './theme';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <ReduxProvider store={store}>
        <HashRouter>
          <AppProvider>
            <App />
          </AppProvider>
        </HashRouter>
      </ReduxProvider>
    </ThemeProvider>
  </React.StrictMode>
);