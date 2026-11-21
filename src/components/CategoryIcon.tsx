import React from 'react';
import {
  Briefcase,
  Dumbbell,
  HeartPulse,
  Lightbulb,
  MapPin,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import { MemoryCategory } from '../types/memory';

interface CategoryIconProps {
  category: MemoryCategory;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, className = 'w-5 h-5' }) => {
  switch (category) {
    case 'work':
      return <Briefcase className={className} />;
    case 'fitness':
      return <Dumbbell className={className} />;
    case 'health':
      return <HeartPulse className={className} />;
    case 'phone':
      return <Phone className={className} />;
    case 'errand':
      return <ShoppingBag className={className} />;
    case 'anchor':
      return <MapPin className={className} />;
    case 'idea':
    default:
      return <Lightbulb className={className} />;
  }
};
