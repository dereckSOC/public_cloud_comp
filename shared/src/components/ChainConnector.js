"use client";

const floatAnimation = `
  @keyframes float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-5px);
    }
  }
  .float-animation {
    animation: float 3s ease-in-out infinite;
  }
`;

export default function ChainConnector({ isCompleted = false, index = 0 }) {
  const delay = index * 0.2; // Match the quest card delay
  const color = isCompleted ? '#16a34a' : '#6b7280'; // green or gray

  return (
    <div className="flex justify-center items-center h-12 relative">
      <style>{floatAnimation}</style>

      {/* Simple vertical column connector with float animation */}
      <div
        className="w-2 h-full rounded float-animation"
        style={{
          backgroundColor: color,
          animationDelay: `${delay}s`
        }}
      ></div>
    </div>
  );
}
