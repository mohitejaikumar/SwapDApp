"use client";
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useState, useEffect } from 'react';
import { useAnchorProvider, WalletButton, WalletDisconnectButton } from '@/components/solana/solana-provider';
import { BN, Program } from '@coral-xyz/anchor';
import IDL from '../swap.json';
import { Swap } from '../types/swap';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { ToastContainer, toast } from 'react-toastify';



export default function SwapComponent() {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState('make');
  const [tokenMintA, setTokenMintA] = useState('');
  const [tokenMintB, setTokenMintB] = useState('');
  const [tokenASwapAmount, setTokenASwapAmount] = useState(0);
  const [tokenBSwapAmount, setTokenBSwapAmount] = useState(0);
  const [offerMakerAccount, setOfferMakerAccount] = useState('');
  const [offerId, setOfferId] = useState<number | null>(null);
  const [makerOfferId, setMakerOfferId] = useState<number | null>(null);
  const provider = useAnchorProvider();

  const program = new Program(IDL as Swap, provider);

  useEffect(() => {
    const generateRandomId = () => {
      const array = new Uint8Array(8);
      crypto.getRandomValues(array);
      const randomNumber = new DataView(array.buffer).getBigUint64(0, true);
      return Number(randomNumber % BigInt(Number.MAX_SAFE_INTEGER));
    };
    setOfferId(generateRandomId());
  }, []);

  async function handleMakeOffer(e: React.FormEvent) {
    if (!publicKey || !offerId) {
      alert('Please connect your wallet');
      return;
    }

    e.preventDefault();

    console.log('Making offer...');
    console.log('Offer Id:', offerId);
    const tx = await program.methods
      .makeOffer(
        new BN(offerId),
        new BN(tokenASwapAmount * 100),
        new BN(tokenBSwapAmount * LAMPORTS_PER_SOL)
      )
      .accounts({
        maker: publicKey,
        tokenMintA: new PublicKey(tokenMintA),
        tokenMintB: new PublicKey(tokenMintB),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log('Offer made:', tx);
    toast.success(`Transaction Signature: ${tx}`);
  }

  async function handleTakeOffer(e: React.FormEvent) {
    if (!publicKey || !makerOfferId) {
      alert('Please connect your wallet');
      return;
    }

    e.preventDefault();
    console.log("offerId", makerOfferId);
    const offerPDA = PublicKey.findProgramAddressSync(
        [
            Buffer.from('offer'),
            new PublicKey(offerMakerAccount).toBuffer(),
            new BN(makerOfferId).toArrayLike(Buffer, 'le', 8)
        ],
        program.programId
    )[0];

    const vault = getAssociatedTokenAddressSync(
        new PublicKey(tokenMintA),
        offerPDA,
        true,
        TOKEN_2022_PROGRAM_ID
    )
    const accounts = {
        taker: publicKey,
        maker: new PublicKey(offerMakerAccount),
        tokenMintA: new PublicKey(tokenMintA),
        tokenMintB: new PublicKey(tokenMintB),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        offer: offerPDA,
        vault,
    };

    console.log(accounts);

    console.log('Taking offer...');
    const tx = await program.methods
      .takeOffer()
      .accounts({
          ...accounts
      })
      .rpc();

    console.log('Offer taken:', tx);
    toast.success(`Transaction Signature: ${tx}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      {publicKey ? (
        <div className="absolute top-4 right-4">
          <WalletDisconnectButton />
        </div>
      ) : (
        <div className="absolute top-4 right-4">
          <WalletButton />
        </div>
        
      )}
      { activeTab === 'make' &&
         <div className="absolute top-[8%] text-center text-green-500">
            OfferId : {offerId}
        </div>
      }
      
      <div className="bg-white p-8 rounded-xl shadow-xl w-96">
        {/* Tabs */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            className={`flex-1 py-2 rounded-lg ${activeTab === 'make' ? 'bg-white shadow' : ''}`}
            onClick={() => setActiveTab('make')}
          >
            Make Offer
          </button>
          <button
            className={`flex-1 py-2 rounded-lg ${activeTab === 'take' ? 'bg-white shadow' : ''}`}
            onClick={() => setActiveTab('take')}
          >
            Take Offer
          </button>
        </div>

        {activeTab === 'make' ? (
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Token Mint A</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter Token Mint A address"
                onChange={(e) => setTokenMintA(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Token Mint B</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter Token Mint B address"
                onChange={(e) => setTokenMintB(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">TokenA Swap Amount</label>
              <input
                type="number"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
                min="0"
                onChange={(e) => setTokenASwapAmount(parseFloat(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">TokenB Swap Amount</label>
              <input
                type="number"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
                min="0"
                onChange={(e) => setTokenBSwapAmount(parseFloat(e.target.value))}
              />
            </div>

            <button
              type="submit"
              onClick={handleMakeOffer}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Create Offer
            </button>
          </form>
        ) : (
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Offer Maker Account</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter maker account address"
                onChange={(e) => setOfferMakerAccount(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Offer Id</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Offer Id"
                onChange={(e) => setMakerOfferId(parseInt(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Token Mint A</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter Token Mint A address"
                onChange={(e) => setTokenMintA(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Token Mint B</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter Token Mint B address"
                onChange={(e) => setTokenMintB(e.target.value)}
              />
            </div>

            <button
              type="submit"
              onClick={handleTakeOffer}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Take Offer
            </button>
          </form>
        )}
      </div>
        <ToastContainer />
    </div>
  );
}