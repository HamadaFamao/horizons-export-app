import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Gem, PlusCircle, MinusCircle, Edit, Save } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { toast } from '@/components/ui/use-toast';

    const mockCoinConfig = {
        packs: [
            { amount: 100, price: 1.99 },
            { amount: 500, price: 8.99 },
            { amount: 1000, price: 16.99 },
            { amount: 5000, price: 79.99 },
        ],
        gifts: [
            { name: "Heart", cost: 50, emoji: "❤️" },
            { name: "Rose", cost: 100, emoji: "🌹" },
            { name: "Diamond", cost: 500, emoji: "💎" },
            { name: "Luxury Gift", cost: 2000, emoji: "🎁" },
        ],
    };

    const AdminCoins = () => {
      const [allUsers, setAllUsers] = useState([]);
      const [selectedUser, setSelectedUser] = useState(null);
      const [amount, setAmount] = useState('');
      const [coinConfig, setCoinConfig] = useState(mockCoinConfig);

      useEffect(() => {
        const users = JSON.parse(localStorage.getItem('singlesDemoUsers') || '[]');
        setAllUsers(users.map(u => ({...u, balance: parseInt(localStorage.getItem(`coins_balance_${u.id}`) || '100')})));
      }, []);

      const handleUserSelect = (user) => {
        setSelectedUser(user);
        setAmount('');
      };

      const adjustBalance = (operation) => {
        if (!selectedUser || !amount) return;

        const numAmount = parseInt(amount, 10);
        if (isNaN(numAmount)) return;

        const newBalance = operation === 'add' ? selectedUser.balance + numAmount : selectedUser.balance - numAmount;
        
        localStorage.setItem(`coins_balance_${selectedUser.id}`, newBalance);
        
        const updatedUsers = allUsers.map(u => u.id === selectedUser.id ? {...u, balance: newBalance} : u);
        setAllUsers(updatedUsers);
        setSelectedUser({...selectedUser, balance: newBalance});

        toast({ title: "Balance Updated!", description: `User ${selectedUser.name}'s balance is now ${newBalance}.`});
        setAmount('');
      };

      const handleConfigChange = (type, index, field, value) => {
        const newConfig = JSON.parse(JSON.stringify(coinConfig));
        newConfig[type][index][field] = value;
        setCoinConfig(newConfig);
      };

      const saveConfig = () => {
        localStorage.setItem('singlesCoinConfig', JSON.stringify(coinConfig));
        toast({ title: "Coin Config Saved!" });
      };


      return (
        <div>
          <h1 className="text-3xl font-bold mb-6">Coin & Gift Economy</h1>
          <div className="grid lg:grid-cols-3 gap-8">
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 card-gradient p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold mb-4">Manage User Coins</h2>
                <div className="space-y-2 mb-4">
                    <Label>Select User</Label>
                    <select className="w-full p-2 border rounded-md" onChange={e => handleUserSelect(allUsers.find(u => u.id === e.target.value))}>
                        <option>-- Select a user --</option>
                        {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                    </select>
                </div>

                {selectedUser && (
                    <div className="mt-4 border-t border-rose-200 pt-4">
                        <p className="font-semibold">Selected: {selectedUser.name}</p>
                        <p className="flex items-center gap-2">Current Balance: <Gem className="w-4 h-4 text-blue-500"/> {selectedUser.balance}</p>
                        <div className="space-y-2 mt-4">
                            <Label htmlFor="amount">Amount</Label>
                            <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 100" />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <Button size="sm" onClick={() => adjustBalance('add')} className="bg-green-500 hover:bg-green-600 text-white"><PlusCircle className="mr-2 h-4 w-4"/> Add</Button>
                            <Button size="sm" variant="destructive" onClick={() => adjustBalance('remove')}><MinusCircle className="mr-2 h-4 w-4"/> Remove</Button>
                        </div>
                    </div>
                )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 card-gradient p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Economy Settings</h2>
                    <Button onClick={saveConfig}><Save className="mr-2 h-4 w-4"/> Save Config</Button>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold mb-2">Coin Packs</h3>
                        {coinConfig.packs.map((pack, i) => (
                            <div key={i} className="flex gap-2 items-center mb-2 bg-white/50 p-2 rounded-md">
                                <Input type="number" value={pack.amount} onChange={e => handleConfigChange('packs', i, 'amount', e.target.value)} className="w-1/2"/>
                                <Input type="number" step="0.01" value={pack.price} onChange={e => handleConfigChange('packs', i, 'price', e.target.value)} className="w-1/2"/>
                            </div>
                        ))}
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Gifts</h3>
                         {coinConfig.gifts.map((gift, i) => (
                            <div key={i} className="flex gap-2 items-center mb-2 bg-white/50 p-2 rounded-md">
                                <span className="text-2xl">{gift.emoji}</span>
                                <Input value={gift.name} onChange={e => handleConfigChange('gifts', i, 'name', e.target.value)} className="w-1/2"/>
                                <Input type="number" value={gift.cost} onChange={e => handleConfigChange('gifts', i, 'cost', e.target.value)} className="w-1/2"/>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
          </div>
        </div>
      );
    };

    export default AdminCoins;