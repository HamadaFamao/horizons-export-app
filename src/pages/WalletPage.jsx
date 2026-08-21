import React from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { ArrowLeft, Gem, ShoppingCart, Gift, Award, Plus, Minus } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useNavigate } from 'react-router-dom';
    import { useCoins } from '@/contexts/CoinsContext';
    import { toast } from '@/components/ui/use-toast';
    import {
      Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger
    } from "@/components/ui/dialog";

    const coinPacks = [
      { amount: 100, price: 1.99, popular: false },
      { amount: 500, price: 8.99, popular: true },
      { amount: 1000, price: 16.99, popular: false },
      { amount: 5000, price: 79.99, popular: false },
    ];

    const WalletPage = () => {
      const navigate = useNavigate();
      const { balance, transactions, purchaseCoins } = useCoins();

      const handleRedeem = () => {
        toast({
          title: "🚧 This feature is coming soon!",
          description: "Redeeming coins for rewards will be available in a future update.",
        });
      };
      
      const getTransactionIcon = (type) => {
        switch(type) {
            case 'purchase': return <ShoppingCart className="w-5 h-5 text-green-500" />;
            case 'gift_sent': return <Gift className="w-5 h-5 text-red-500" />;
            case 'bonus': return <Award className="w-5 h-5 text-yellow-500" />;
            default: return <Gem className="w-5 h-5 text-gray-500" />;
        }
      };
      
      const getTransactionSign = (type) => {
        return type === 'gift_sent' ? '-' : '+';
      }

      return (
        <>
          <Helmet>
            <title>My Wallet - Famo</title>
            <meta name="description" content="Manage your Famo Coins, view transaction history, and purchase more coins." />
          </Helmet>

          <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
            <header className="bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40">
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5 mr-2" /> Back</Button>
                  <h1 className="text-2xl font-bold gradient-text">My Wallet</h1>
                  <div className="w-24"></div>
                </div>
              </div>
            </header>

            <div className="container mx-auto px-4 py-8 max-w-4xl">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                
                <div className="card-gradient p-8 rounded-2xl shadow-lg text-center">
                  <h2 className="text-lg font-semibold text-gray-600 mb-2">Current Balance</h2>
                  <div className="flex items-center justify-center gap-3">
                    <Gem className="w-10 h-10 text-blue-500" />
                    <motion.p initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-6xl font-bold gradient-text">{balance}</motion.p>
                  </div>
                  <p className="text-gray-500 mt-1">Famo Coins</p>
                  <div className="flex gap-4 justify-center mt-6">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="btn-gradient text-white"><ShoppingCart className="mr-2 h-4 w-4" />Buy Coins</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="gradient-text text-2xl mb-2">Buy Coins</DialogTitle>
                                <DialogDescription>Select a pack to top up your wallet.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                {coinPacks.map(pack => (
                                    <div key={pack.amount} className={`p-4 border rounded-lg text-center cursor-pointer hover:border-rose-500 transition-all ${pack.popular ? 'border-rose-500 border-2' : ''}`} onClick={() => purchaseCoins(pack.amount)}>
                                        <p className="text-2xl font-bold flex items-center justify-center gap-2"><Gem className="w-5 h-5 text-blue-500"/>{pack.amount}</p>
                                        <p className="text-lg font-semibold">${pack.price}</p>
                                    </div>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" onClick={handleRedeem}><Award className="mr-2 h-4 w-4" />Redeem Coins</Button>
                  </div>
                </div>

                <div className="card-gradient p-6 rounded-2xl shadow-lg">
                  <h2 className="text-xl font-bold mb-4">Transaction History</h2>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {transactions.length > 0 ? transactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {getTransactionIcon(tx.type)}
                                <div>
                                    <p className="font-semibold">{tx.description}</p>
                                    <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleString()}</p>
                                </div>
                            </div>
                            <p className={`font-bold flex items-center ${tx.amount < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {getTransactionSign(tx.type)} {Math.abs(tx.amount)} <Gem className="w-4 h-4 ml-1" />
                            </p>
                        </div>
                    )) : (
                        <p className="text-center text-gray-500 py-8">No transactions yet.</p>
                    )}
                  </div>
                </div>

              </motion.div>
            </div>
          </div>
        </>
      );
    };

    export default WalletPage;