import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import logo from "@/assets/Icon.png";

export function FloatingOrb() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 0, scale: 1 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 120 }}
    >
      <Link to="/app/chat" className="relative block animate-float-orb" aria-label="Open AI chat">
        <img src={logo} alt="" width={56} height={26} className="h-14 w-14" />
      </Link>
    </motion.div>
  );
}
