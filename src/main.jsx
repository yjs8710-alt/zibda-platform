import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>🚀 Zibda Platform</h1>
      <p>부동산 공실 관리 플랫폼</p>
      <p>Vercel 배포 완료!</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)