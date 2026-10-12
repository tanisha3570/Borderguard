import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App.jsx';

try {
  const html = renderToString(React.createElement(App));
  console.log('✅ React SSR render successful! Length:', html.length);
  console.log('Snippet:', html.slice(0, 400));
} catch (err) {
  console.error('❌ React render failed with error:', err);
}
