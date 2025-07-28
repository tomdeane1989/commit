import { getVersionInfo } from '../lib/version';

const VersionDisplay: React.FC = () => {
  const { displayText, environment } = getVersionInfo();
  
  return (
    <div className="fixed bottom-4 left-4 z-10">
      <div className="flex items-center space-x-2 opacity-30 hover:opacity-60 transition-opacity duration-300">
        {/* Logo placeholder - subtle transparent circle */}
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 opacity-40"></div>
        
        {/* Version text */}
        <span className="text-xs font-mono text-gray-500 select-none">
          {displayText}
        </span>
        
        {/* Environment indicator dot */}
        <div 
          className={`w-2 h-2 rounded-full ${
            environment === 'development' 
              ? 'bg-blue-400' 
              : environment === 'staging' 
                ? 'bg-yellow-400' 
                : 'bg-green-400'
          }`}
          title={`Environment: ${environment}`}
        ></div>
      </div>
    </div>
  );
};

export default VersionDisplay;