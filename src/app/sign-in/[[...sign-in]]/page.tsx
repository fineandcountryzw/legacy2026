"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Building2, Shield, Users, BarChart3, Eye, EyeOff, Loader2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 bg-brand-black relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-brand-gold rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-gold rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo Area */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">Fine & Country</span>
            </div>
            <p className="text-brand-gold font-medium">Zimbabwe</p>
          </div>

          {/* Value Props */}
          <div className="space-y-8">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Stand Inventory &<br />
              <span className="text-brand-gold">Reconciliation</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-md">
              Professional finance-style management system for stand inventories, 
              developments, and automated payment reconciliation.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Secure</h3>
                  <p className="text-sm text-gray-400">Enterprise-grade security</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Collaborative</h3>
                  <p className="text-sm text-gray-400">Multi-user access</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Analytics</h3>
                  <p className="text-sm text-gray-400">Real-time insights</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Developments</h3>
                  <p className="text-sm text-gray-400">Manage multiple estates</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-sm text-gray-500">
            © 2026 Fine & Country Zimbabwe. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Side - Sign In Form */}
      <div className="flex-1 flex flex-col justify-center items-center bg-brand-light p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-brand-black">Fine & Country</span>
              <p className="text-brand-gold text-sm font-medium">Zimbabwe</p>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-brand-black mb-2">
              Welcome back
            </h2>
            <p className="text-brand-grey">
              Sign in to access your dashboard
            </p>
          </div>

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brand-black mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-brand-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-black mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-brand-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-grey hover:text-brand-black"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-brand-gold hover:bg-brand-gold/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-brand-grey">
            <p>© 2026 Fine & Country Zimbabwe. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
