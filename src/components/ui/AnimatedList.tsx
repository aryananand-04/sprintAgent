import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedListProps {
  children: ReactNode[]
  className?: string
  delay?: number
}

const itemVariants = {
  hidden: { opacity: 0, x: 12, filter: 'blur(2px)' },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: {
      delay: i * 0.05,
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.15 },
  },
}

export function AnimatedList({ children, className, delay = 0 }: AnimatedListProps) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          custom={i + delay}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          layout
          className={className}
        >
          {child}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
