"use client";

import { SignUp } from "@clerk/nextjs";
import { Building2, Shield, Users, BarChart3 } from "lucide-react";

export default function SignUpPage() {
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
              Get Started<br />
              <span className="text-brand-gold">Today</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-md">
              Join Fine & Country Zimbabwe's stand inventory management platform. 
              Streamline your developments and reconcile payments with ease.
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

      {/* Right Side - Sign Up Form */}
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
              Create your account
            </h2>
            <p className="text-brand-grey">
              Get started with Fine & Country Zimbabwe
            </p>
          </div>

          {/* Clerk Sign Up */}
          <div className="flex justify-center">
            <SignUp 
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-white shadow-forensic border border-brand-divider rounded-xl w-full",
                  headerTitle: "text-brand-black font-bold",
                  headerSubtitle: "text-brand-grey",
                  socialButtonsBlockButton: "border-brand-divider hover:bg-brand-light",
                  formFieldLabel: "text-brand-black font-medium",
                  formFieldInput: "border-brand-divider focus:border-brand-gold focus:ring-brand-gold",
                  formButtonPrimary: "bg-brand-gold hover:bg-brand-gold/90 text-white",
                  footerActionLink: "text-brand-gold hover:text-brand-gold/80",
                  dividerLine: "bg-brand-divider",
                  dividerText: "text-brand-grey",
                },
              }}
              routing="path"
              path="/sign-up"
              redirectUrl="/dashboard"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
