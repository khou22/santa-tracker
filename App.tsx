import React, { useState, useEffect, useRef } from 'react';
import MapComponent from './components/MapComponent';
import SnowOverlay from './components/SnowOverlay';
import { geocodeLocation, optimizeRoute, generateArrivalMessage, generateDeliveryImage } from './services/geminiService';
import { playSparkleSound, playHoHoHo, playArrivalChime } from './services/audioService';
import { Stop, SantaState, GameStatus, Coordinates } from './types';
import { NORTH_POLE } from './constants';
import { MapPin, Gift, Play, RotateCcw, Plus, Loader2, Sparkles, Navigation, Volume2, Check, X, FastForward, Camera, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [stops, setStops] = useState<Stop[]>([]);
  const [santa, setSanta] = useState<SantaState>({
    currentPosition: NORTH_POLE,
    targetStopId: null,
    isPlaying: false,
    speed: 1,
    isDelivering: false
  });
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLANNING);
  const [loading, setLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string>("Waiting for instructions at the North Pole...");
  
  // Confirmation Dialog State
  const [pendingDeliveryStop, setPendingDeliveryStop] = useState<Stop | null>(null);
  
  // Image Generation State
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [deliveryImage, setDeliveryImage] = useState<string | null>(null);
  const [completedDeliveryStop, setCompletedDeliveryStop] = useState<Stop | null>(null);

  // Input State
  const [locationInput, setLocationInput] = useState('');
  const [presentInput, setPresentInput] = useState('');

  // Refs for animation loop and state access
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const stateRef = useRef({ santa, stops, status, pendingDeliveryStop });
  const lastArrivalStopIdRef = useRef<string | null>(null); // Prevents double triggering arrival logic

  // Keep stateRef in sync with render state
  useEffect(() => {
    stateRef.current = { santa, stops, status, pendingDeliveryStop };
  }, [santa, stops, status, pendingDeliveryStop]);

  // Handlers
  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationInput || !presentInput) return;

    setLoading(true);
    const result = await geocodeLocation(locationInput);
    
    if (result) {
      const newStop: Stop = {
        id: Math.random().toString(36).substr(2, 9),
        name: result.formattedName,
        present: presentInput,
        coordinates: { lat: result.lat, lng: result.lng },
        isDelivered: false,
        isNext: false
      };
      setStops(prev => [...prev, newStop]);
      setLocationInput('');
      setPresentInput('');
      setCurrentMessage(`Added ${result.formattedName} to the list!`);
    } else {
      setCurrentMessage(`Could not find location "${locationInput}". Try "City, Country" format.`);
    }
    setLoading(false);
  };

  const handleOptimize = async () => {
    setLoading(true);
    setCurrentMessage("Consulting the elves (Gemini) for the best route...");
    const optimizedIds = await optimizeRoute(stops);
    
    // Reorder stops based on IDs
    const reorderedStops = optimizedIds
        .map(id => stops.find(s => s.id === id))
        .filter((s): s is Stop => s !== undefined);
        
    setStops(reorderedStops);
    setLoading(false);
    setCurrentMessage("Route optimized for maximum efficiency!");
  };

  const handleStartDelivery = () => {
    if (stops.length === 0) return;
    setStatus(GameStatus.DELIVERING);
    // Reset arrival tracking
    lastArrivalStopIdRef.current = null;
    
    setSanta(prev => ({ ...prev, isPlaying: true, targetStopId: stops[0].id, isDelivering: false }));
    setCurrentMessage("Santa is taking off! 🦌💨");
    setPendingDeliveryStop(null);
    setDeliveryImage(null);
    
    // Pre-load voices if possible
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }
  };

  const handleReset = () => {
    setStatus(GameStatus.PLANNING);
    setStops(prev => prev.map(s => ({ ...s, isDelivered: false, isNext: false })));
    setSanta({
      currentPosition: NORTH_POLE,
      targetStopId: null,
      isPlaying: false,
      speed: 1,
      isDelivering: false
    });
    setPendingDeliveryStop(null);
    setDeliveryImage(null);
    lastArrivalStopIdRef.current = null;
    setCurrentMessage("Back to the drawing board!");
  };

  // Move to next stop or finish
  const proceedToNextStop = (currentStopId: string) => {
    const currentIndex = stops.findIndex(s => s.id === currentStopId);
    if (currentIndex < stops.length - 1) {
        const nextStop = stops[currentIndex + 1];
        lastArrivalStopIdRef.current = null; // Reset for next stop
        setSanta(prev => ({ ...prev, isPlaying: true, targetStopId: nextStop.id, isDelivering: false }));
        setCurrentMessage(`En route to ${nextStop.name}...`);
    } else {
        setStatus(GameStatus.FINISHED);
        setCurrentMessage("All presents delivered! Merry Christmas! 🎄");
        setSanta(prev => ({ ...prev, isDelivering: false }));
        playHoHoHo();
    }
  };

  // Helper to manage the delivery sequence
  const executeDeliverySequence = async (stop: Stop) => {
    // 0. Set Visual States
    setSanta(prev => ({ ...prev, isDelivering: true }));
    setIsGeneratingImage(true);
    setCurrentMessage(`Capturing delivery magic at ${stop.name}...`);

    // 1. Play Sparkle Sound & Mark on Map visually
    playSparkleSound();
    setStops(prev => prev.map(s => s.id === stop.id ? { ...s, isDelivered: true } : s));

    // 2. Generate Image (Async)
    const imageUrl = await generateDeliveryImage(stop.name, stop.present);
    setIsGeneratingImage(false);

    // 3. Show Result
    if (imageUrl) {
        setDeliveryImage(imageUrl);
        setCompletedDeliveryStop(stop);
        playHoHoHo();
        // Wait for user to dismiss modal
        const msg = await generateArrivalMessage(stop.name, stop.present);
        setCurrentMessage(msg);
    } else {
        // Fallback if image fails - just proceed after a short delay
        playHoHoHo();
        const msg = await generateArrivalMessage(stop.name, stop.present);
        setCurrentMessage(msg);
        await new Promise(resolve => setTimeout(resolve, 3000));
        proceedToNextStop(stop.id);
    }
  };

  const handleCloseDeliveryModal = () => {
      setDeliveryImage(null);
      setCompletedDeliveryStop(null);
      if (santa.targetStopId) {
          proceedToNextStop(santa.targetStopId);
      }
  };

  const handleConfirmDelivery = () => {
      if (pendingDeliveryStop) {
          const stop = pendingDeliveryStop;
          setPendingDeliveryStop(null); // Close confirmation modal
          executeDeliverySequence(stop); // Start delivery/generation
      }
  };

  const handleSkipStop = (stopId: string) => {
    setPendingDeliveryStop(null);
    proceedToNextStop(stopId);
    setCurrentMessage("Skipping this stop...");
  };

  const handleCancelDelivery = () => {
      // Just close the modal. Santa stays at the location (isPlaying is still false).
      // The user can then use the sidebar controls to Deliver or Skip.
      setPendingDeliveryStop(null);
      setCurrentMessage("Delivery paused. Waiting for instructions...");
  };

  // Animation Loop
  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;
      
      // Access fresh state from Ref to avoid closure staleness
      const { santa: currentSanta, stops: currentStops, pendingDeliveryStop: currentPending } = stateRef.current;

      // Only move if playing and has a target
      if (currentSanta.isPlaying && currentSanta.targetStopId) {
        const targetStop = currentStops.find(s => s.id === currentSanta.targetStopId);
        
        if (targetStop && !isNaN(targetStop.coordinates.lat) && !isNaN(targetStop.coordinates.lng)) {
          // Linear Movement Calculation
          const dLat = targetStop.coordinates.lat - currentSanta.currentPosition.lat;
          const dLng = targetStop.coordinates.lng - currentSanta.currentPosition.lng;
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);

          // Guard against NaN distance calculations
          if (isNaN(dist)) return;

          // Speed: degrees per second. 
          // Adjusted to 12 for a good balance of speed and control.
          const degreesPerSecond = 12 * currentSanta.speed; 
          const step = degreesPerSecond * (deltaTime / 1000);

          // Arrival threshold
          if (dist <= step || dist < 0.005) {
            // SNAP to exact location
            // Only trigger if we haven't already processed arrival for this stop
            if (lastArrivalStopIdRef.current !== targetStop.id) {
                lastArrivalStopIdRef.current = targetStop.id;
                
                setSanta(prev => ({ 
                    ...prev, 
                    currentPosition: targetStop.coordinates,
                    isPlaying: false // STOP animation loop movement
                }));
                
                // Play Arrival Chime and Show Confirmation Dialog
                playArrivalChime();
                setPendingDeliveryStop(targetStop);
                setCurrentMessage(`Arrived at ${targetStop.name}! Waiting for confirmation...`);
            }
          } else {
            // Move linearly towards target
            const ratio = step / dist;
            
            // Safety check for next position
            if (isFinite(ratio)) {
              setSanta(prev => ({
                ...prev,
                currentPosition: {
                  lat: prev.currentPosition.lat + dLat * ratio,
                  lng: prev.currentPosition.lng + dLng * ratio
                }
              }));
            }
          }
        }
      }
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  // Start/Stop animation loop based on playing state
  useEffect(() => {
    if (santa.isPlaying) {
        lastTimeRef.current = performance.now();
        requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [santa.isPlaying]); // Only restart loop when play state toggles

  // Determine if we are in a "waiting" state (arrived but modal closed)
  const isWaitingAtStop = status === GameStatus.DELIVERING && !santa.isPlaying && !pendingDeliveryStop && !deliveryImage && !isGeneratingImage && santa.targetStopId;
  const currentStop = stops.find(s => s.id === santa.targetStopId);


  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans text-slate-900">
      <SnowOverlay />

      {/* Loading Overlay for Image Generation */}
      {isGeneratingImage && (
        <div className="fixed inset-0 z-[2010] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center">
             <div className="relative mb-4">
                 <Loader2 className="animate-spin text-red-600" size={48} />
                 <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-yellow-500 animate-pulse" size={24} />
             </div>
             <h3 className="text-xl font-bold text-gray-800 mb-2">Capturing Magic...</h3>
             <p className="text-gray-500 text-sm">Santa is delivering the gift and our elf-drones are taking a photo!</p>
           </div>
        </div>
      )}

      {/* Delivery Image Result Modal */}
      {deliveryImage && completedDeliveryStop && (
         <div className="fixed inset-0 z-[2020] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in zoom-in-95 duration-300 p-4">
            <div className="bg-white p-3 pb-8 rounded shadow-2xl transform rotate-1 max-w-lg w-full flex flex-col relative">
                <div className="bg-gray-100 w-full aspect-square rounded overflow-hidden relative shadow-inner mb-4">
                     <img src={deliveryImage} alt="Delivery Snapshot" className="w-full h-full object-cover" />
                     <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                         <Camera size={12} />
                         AI Generated
                     </div>
                </div>
                <h2 className="text-center font-handwriting text-2xl font-bold text-gray-800 transform -rotate-1">
                    Special Delivery at {completedDeliveryStop.name}!
                </h2>
                <p className="text-center text-gray-500 mt-1 italic text-sm">
                    Enjoy your {completedDeliveryStop.present}!
                </p>

                <button 
                    onClick={handleCloseDeliveryModal}
                    className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                >
                    Next Stop <ArrowRight size={20} />
                </button>
            </div>
         </div>
      )}

      {/* Confirmation Modal */}
      {pendingDeliveryStop && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform scale-100 animate-pop border-4 border-red-100 relative">
            <button 
                onClick={handleCancelDelivery}
                className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Cancel / Wait"
            >
                <X size={20} />
            </button>
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <MapPin className="text-red-600" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Arrived!</h3>
            <p className="text-gray-600 mb-6">
              Santa has reached <span className="font-semibold text-gray-800">{pendingDeliveryStop.name}</span>.
              <br/>
              Ready to deliver <span className="font-semibold text-red-600">{pendingDeliveryStop.present}</span>?
            </p>
            <div className="flex flex-col gap-3">
                <button 
                    onClick={handleConfirmDelivery}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 transform active:scale-95"
                >
                    <Check size={20} strokeWidth={3} />
                    Deliver Present
                </button>
                <button 
                    onClick={() => handleSkipStop(pendingDeliveryStop.id)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <FastForward size={18} />
                    Skip This Stop
                </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-red-700 text-white p-4 shadow-lg z-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-full">
                <Sparkles size={24} className="text-yellow-300" />
            </div>
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Santa Tracker AI</h1>
                <p className="text-xs text-red-200">Powered by Gemini 2.5 Flash</p>
            </div>
        </div>
        <div className="bg-black/30 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10 max-w-md hidden md:block">
            <p className="text-sm font-medium flex items-center gap-2">
                <Navigation size={16} />
                {currentMessage}
            </p>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row relative">
        
        {/* Sidebar Controls */}
        <aside className="w-full md:w-96 bg-white shadow-xl z-10 flex flex-col border-r border-slate-200 h-1/2 md:h-full">
            <div className="p-6 bg-slate-50 border-b border-slate-200">
                {status === GameStatus.PLANNING ? (
                     <form onSubmit={handleAddStop} className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Destination</label>
                         <div className="relative">
                             <MapPin className="absolute left-3 top-2.5 text-slate-400" size={16} />
                             <input 
                                 type="text" 
                                 value={locationInput}
                                 onChange={(e) => setLocationInput(e.target.value)}
                                 placeholder="e.g. Paris, France" 
                                 className="w-full pl-9 pr-3 py-2 bg-slate-700 text-white placeholder-slate-400 border border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"
                             />
                         </div>
                     </div>
                     <div>
                         <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Present</label>
                         <div className="relative">
                             <Gift className="absolute left-3 top-2.5 text-slate-400" size={16} />
                             <input 
                                 type="text" 
                                 value={presentInput}
                                 onChange={(e) => setPresentInput(e.target.value)}
                                 placeholder="e.g. Giant Teddy Bear" 
                                 className="w-full pl-9 pr-3 py-2 bg-slate-700 text-white placeholder-slate-400 border border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"
                             />
                         </div>
                     </div>
                     <button 
                         type="submit" 
                         disabled={loading || !locationInput || !presentInput}
                         className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                         {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                         Add Stop
                     </button>
                 </form>
                ) : (
                    <div className="text-center py-4">
                        <div className="inline-block p-4 bg-green-100 rounded-full mb-3">
                            {status === GameStatus.FINISHED ? <Sparkles className="text-green-600" size={32}/> : <Loader2 className="animate-spin text-green-600" size={32}/>}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {status === GameStatus.FINISHED ? "Mission Complete!" : "Deliveries in Progress"}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">{stops.filter(s => s.isDelivered).length} / {stops.length} Delivered</p>
                        {status === GameStatus.DELIVERING && !isWaitingAtStop && (
                            <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
                                <Volume2 size={12} />
                                Sound On
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {stops.length === 0 && (
                    <div className="text-center text-slate-400 py-8 italic">
                        No stops added yet. <br/> Help Santa plan his route!
                    </div>
                )}
                {stops.map((stop, index) => (
                    <div key={stop.id} className={`p-4 rounded-xl border transition-all ${stop.isDelivered ? 'bg-green-50 border-green-200 opacity-75' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md min-w-[20px] text-center">#{index + 1}</span>
                                {stop.name}
                            </h3>
                            {stop.isDelivered && <span className="text-green-600"><Sparkles size={16} /></span>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 pl-8">
                            <Gift size={14} />
                            {stop.present}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="p-4 bg-white border-t border-slate-200 space-y-2">
                {status === GameStatus.PLANNING && stops.length > 1 && (
                     <button 
                        onClick={handleOptimize}
                        disabled={loading}
                        className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                        AI Optimize Route
                    </button>
                )}
                
                {status === GameStatus.PLANNING && (
                    <button 
                        onClick={handleStartDelivery}
                        disabled={stops.length === 0 || loading}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-200 transition-all transform active:scale-95 disabled:opacity-50 disabled:shadow-none"
                    >
                        <Play size={20} fill="currentColor" />
                        Start Delivery Run
                    </button>
                )}

                {/* Waiting State Controls - Show if user cancelled the modal but still needs to act */}
                {isWaitingAtStop && currentStop && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2">
                         <div className="text-center text-sm font-semibold text-slate-500 pb-1">
                            Waiting at {currentStop.name}
                        </div>
                        <button 
                            onClick={() => executeDeliverySequence(currentStop)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md"
                        >
                            <Check size={20} />
                            Deliver Present
                        </button>
                        <button 
                            onClick={() => handleSkipStop(currentStop.id)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 rounded-xl flex items-center justify-center gap-2"
                        >
                            <FastForward size={18} />
                            Skip Stop
                        </button>
                    </div>
                )}

                {status !== GameStatus.PLANNING && (
                    <button 
                        onClick={handleReset}
                        className="w-full bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        <RotateCcw size={20} />
                        Reset & Plan New Route
                    </button>
                )}
            </div>
        </aside>

        {/* Map Area */}
        <section className="flex-1 relative h-1/2 md:h-full z-0">
            <MapComponent stops={stops} santa={santa} />
            
            {/* Mobile overlay for messages */}
            <div className="absolute bottom-4 left-4 right-4 md:hidden z-[1000]">
                 <div className="bg-black/80 text-white p-3 rounded-lg backdrop-blur text-sm text-center shadow-xl">
                    {currentMessage}
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default App;