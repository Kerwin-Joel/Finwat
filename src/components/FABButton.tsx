import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';

interface FABButtonProps {
    onClick: () => void;
}

const FABButton: React.FC<FABButtonProps> = ({ onClick }) => {
    return (
        <motion.div
            className="fixed bottom-20 right-4 z-40 md:absolute md:bottom-8 md:right-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
        >
            <Button
                onClick={onClick}
                size="icon"
                className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20"
            >
                <Plus className="h-8 w-8 text-white" />
            </Button>
            <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping -z-10" />
        </motion.div>
    );
};

export default FABButton;
