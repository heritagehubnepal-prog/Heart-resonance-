import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { EmotionData } from '../types';

interface EmotionChartProps {
  data: EmotionData[];
}

const EmotionChart: React.FC<EmotionChartProps> = ({ data }) => {
  return (
    <div className="w-full h-64 md:h-80 relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#ffffff33" />
          <PolarAngleAxis 
            dataKey="label" 
            tick={{ fill: '#e0d0f5', fontSize: 14, fontFamily: 'Mukta' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="तीव्रता"
            dataKey="score"
            stroke="#c084fc"
            strokeWidth={2}
            fill="#a855f7"
            fillOpacity={0.4}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(15, 5, 24, 0.9)', border: '1px solid #4c3a6e', borderRadius: '8px', color: '#fff', fontFamily: 'Mukta' }}
            itemStyle={{ color: '#d8b4fe' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EmotionChart;