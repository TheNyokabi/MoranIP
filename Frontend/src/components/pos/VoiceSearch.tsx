'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Mic,
    MicOff,
    Search,
    X,
    Loader2,
    Scan
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceSearchProps {
    value: string;
    onChange: (value: string) => void;
    onBarcodeClick?: () => void;
    placeholder?: string;
    className?: string;
}

export function VoiceSearch({
    value,
    onChange,
    onBarcodeClick,
    placeholder = 'Search products...',
    className
}: VoiceSearchProps) {
    const [isListening, setIsListening] = React.useState(false);
    const [isSupported, setIsSupported] = React.useState(false);
    const [transcript, setTranscript] = React.useState('');
    const recognitionRef = React.useRef<any>(null);

    React.useEffect(() => {
        // Check if Web Speech API is supported
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                setIsSupported(true);
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onresult = (event: any) => {
                    const result = event.results[event.results.length - 1];
                    const text = result[0].transcript;
                    setTranscript(text);
                    
                    if (result.isFinal) {
                        onChange(text);
                        setIsListening(false);
                        setTranscript('');
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    setIsListening(false);
                    setTranscript('');
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, [onChange]);

    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            setTranscript('');
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
                // Haptic feedback
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            } catch (error) {
                console.error('Failed to start speech recognition:', error);
            }
        }
    };

    const handleClear = () => {
        onChange('');
        setTranscript('');
    };

    return (
        <div className={cn("relative", className)}>
            {/* Search Input */}
            <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-zinc-400 pointer-events-none" />
                
                <Input
                    type="text"
                    value={isListening ? transcript : value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={isListening ? 'Listening...' : placeholder}
                    className={cn(
                        "pl-10 pr-24 h-12 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500",
                        "rounded-xl text-base",
                        isListening && "bg-zinc-700 border-emerald-500"
                    )}
                    readOnly={isListening}
                />

                {/* Action Buttons */}
                <div className="absolute right-2 flex items-center gap-1">
                    {/* Clear Button */}
                    <AnimatePresence>
                        {(value || transcript) && !isListening && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-zinc-400 hover:text-white"
                                    onClick={handleClear}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Barcode Button */}
                    {onBarcodeClick && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-white"
                            onClick={onBarcodeClick}
                        >
                            <Scan className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Voice Button */}
                    {isSupported && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8 transition-colors",
                                isListening 
                                    ? "text-emerald-400 bg-emerald-500/20" 
                                    : "text-zinc-400 hover:text-white"
                            )}
                            onClick={toggleListening}
                        >
                            {isListening ? (
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                >
                                    <MicOff className="h-4 w-4" />
                                </motion.div>
                            ) : (
                                <Mic className="h-4 w-4" />
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Listening Indicator */}
            <AnimatePresence>
                {isListening && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute left-0 right-0 -bottom-8 flex items-center justify-center gap-2"
                    >
                        <motion.div
                            className="flex gap-1"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
                                    animate={{
                                        scale: [1, 1.5, 1],
                                        opacity: [0.5, 1, 0.5]
                                    }}
                                    transition={{
                                        duration: 0.8,
                                        repeat: Infinity,
                                        delay: i * 0.2
                                    }}
                                />
                            ))}
                        </motion.div>
                        <span className="text-xs text-emerald-400">Listening...</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default VoiceSearch;
