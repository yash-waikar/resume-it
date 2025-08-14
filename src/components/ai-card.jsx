import React from "react";
import { Card } from "./ui/card";
import { Brain, Cpu, Zap } from "lucide-react";
import { cn } from "../lib/utils";

export function AIAnalyzingCard({ 
  title = "AI Analyzing", 
  subtitle = "Processing your request...",
  variant = "default",
  className 
}) {
  const getDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );

  if (variant === "compact") {
    return (
      <Card className={cn(
        "relative p-4 bg-gray-800/50 backdrop-blur-sm border-blue-400/20 overflow-hidden",
        className
      )}>
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Brain className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-100">{title}</p>
          </div>
          {getDots()}
        </div>
      </Card>
    );
  }

  if (variant === "detailed") {
    return (
      <Card className={cn(
        "relative p-8 bg-gray-800/50 backdrop-blur-sm border-blue-400/20 overflow-hidden",
        className
      )}>
        <div className="text-center space-y-6">
          <div className="flex justify-center space-x-4">
            <div className="p-3 rounded-full bg-blue-400/10 border border-blue-400/20">
              <Brain className="w-8 h-8 text-blue-400" />
            </div>
            <div className="p-3 rounded-full bg-gray-400/10 border border-gray-400/20">
              <Cpu className="w-8 h-8 text-gray-400" />
            </div>
            <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/20">
              <Zap className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-100">{title}</h3>
            <p className="text-gray-300">{subtitle}</p>
          </div>

          <div className="flex justify-center items-center space-x-2">
            <span className="text-sm text-gray-300">Processing</span>
            {getDots()}
          </div>
          <div className = "flex justify-center items-center space-x-2">
            
          </div>

          <div className="w-full bg-gray-700/20 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-400 to-gray-400 animate-pulse rounded-full" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "relative p-6 bg-gray-800/50 backdrop-blur-sm border-blue-400/20 overflow-hidden",
      className
    )}>
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          <div className="p-2 rounded-full bg-blue-400/10 border border-blue-400/20">
            <Brain className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="font-medium text-gray-100">{title}</h3>
          <p className="text-sm text-gray-300">{subtitle}</p>
        </div>
        <div className="flex-shrink-0">
          {getDots()}
        </div>
      </div>
    </Card>
  );
}
