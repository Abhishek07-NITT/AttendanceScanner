"use client";
import React from 'react'
import { useEffect,useState } from 'react';



const page = () => {
    const [Qr, setQr] = useState(null)
   
    
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Qr Generator
        </h1>
      <form className="space-y-4 mt-4" onSubmit={async (e)=>{
        e.preventDefault();
        const res=await fetch('/api/qr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: e.target[0].value,
            rollNo: e.target[1].value,
          }),
        });
        const data= await res.json();
        setQr(data.qrCode);
        console.log(data);
        
        alert("Qr Generated!");
      }}>
        <input
          type="text"
          placeholder="Enter your name"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
          <input
            type="text"
            placeholder="Enter your roll no"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <button
            type="submit"
            className="w-full py-2 mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-200"
          >
            Create Qr
          </button>
        </form>
        {Qr && <div className="flex flex-col items-center mt-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Your QR Code:</h2>
          <img src={Qr} alt="QR Code" className="w-48 h-48"/>
        </div>}
    </div>
    
    </div>
  )
}

export default page
