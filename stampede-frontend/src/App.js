import React from 'react';

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)'
      }}>
        <h1 style={{
          fontSize: '3rem',
          marginBottom: '20px',
          background: 'linear-gradient(45deg, #00ffff, #ff00ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          STAMPEDE GUARD 3D
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#00ffff' }}>
          AI-Powered Crowd Monitoring System
        </p>
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '10px',
          border: '1px solid #00ffff'
        }}>
          <p style={{ color: '#00ff00', fontWeight: 'bold' }}>✅ System Online</p>
          <p style={{ color: '#ccc', fontSize: '0.9rem', marginTop: '10px' }}>
            Ready for crowd detection and emergency response
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
