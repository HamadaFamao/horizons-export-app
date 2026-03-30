import React, { useState, useEffect } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Gem } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import {
      Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
    } from "@/components/ui/dialog";

    const defaultGifts = [
      { name: "Heart", cost: 50, emoji: "❤️" },
      { name: "Rose", cost: 100, emoji: "🌹" },
      { name: "Diamond", cost: 500, emoji: "💎" },
      { name: "Luxury Gift", cost: 2000, emoji: "🎁" },
    ];

    const GiftModal = ({ isOpen, onOpenChange, onSendGift }) => {
      const [gifts, setGifts] = useState(defaultGifts);
      const [selectedGift, setSelectedGift] = useState(null);

      useEffect(() => {
        const storedConfig = JSON.parse(localStorage.getItem('singlesCoinConfig'));
        if(storedConfig && storedConfig.gifts) {
            setGifts(storedConfig.gifts);
        }
      }, []);

      const handleSelect = (gift) => {
        setSelectedGift(gift);
      };

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="gradient-text text-2xl text-center">Send a Gift</DialogTitle>
              <DialogDescription className="text-center">Show them you care by sending a virtual gift!</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              {gifts.map(gift => (
                <motion.div
                  key={gift.name}
                  onClick={() => handleSelect(gift)}
                  className={`p-4 border-2 rounded-xl text-center cursor-pointer transition-all ${selectedGift?.name === gift.name ? 'border-rose-500 bg-rose-50 scale-105' : 'border-gray-200'}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="text-5xl mb-2">{gift.emoji}</div>
                  <p className="font-semibold">{gift.name}</p>
                  <p className="flex items-center justify-center text-sm text-gray-600 gap-1">
                    <Gem className="w-4 h-4 text-blue-500" />
                    {gift.cost}
                  </p>
                </motion.div>
              ))}
            </div>
            <Button 
                onClick={() => onSendGift(selectedGift)} 
                disabled={!selectedGift}
                className="w-full btn-gradient text-white"
            >
                Send {selectedGift?.name || 'Gift'}
            </Button>
          </DialogContent>
        </Dialog>
      );
    };

    export default GiftModal;