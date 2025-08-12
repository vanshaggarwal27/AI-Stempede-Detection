import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex flex-col items-center justify-center text-white">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          STAMPEDE GUARD 3D
        </h1>
        <p className="text-xl text-cyan-300">
          AI-Powered Crowd Monitoring System
        </p>
        <div className="mt-8 p-6 bg-black/40 backdrop-blur-xl rounded-2xl border border-cyan-400/30">
          <p className="text-green-400 font-bold">✅ System Online</p>
          <p className="text-gray-300 text-sm mt-2">Ready for crowd detection</p>
        </div>
      </header>
    </div>
  );
}

export default App;
