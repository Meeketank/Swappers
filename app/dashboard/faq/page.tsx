"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardHeader from '@/app/components/DashboardHeader';

export default function FAQPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const faqs = [
    {
      question: "How do I update my profile information?",
      answer: "You can update your profile information by navigating to the Profile page from your dashboard. Make your changes and click 'Save Profile' to update your information. Remember that some fields like your email cannot be changed for security reasons."
    },
    {
      question: "What skills can I list on my profile?",
      answer: "You can list any skills you're comfortable teaching others (under Skills Offered) and skills you'd like to learn (under Skills Wanted). Please keep them professional and appropriate. Our system automatically checks for inappropriate content."
    },
    {
      question: "How does the rating system work?",
      answer: "Your rating is calculated based on feedback from other users you've interacted with. After each skill exchange, both parties can rate their experience. The average of these ratings is displayed on your profile."
    },
    {
      question: "Why is my account marked as private?",
      answer: "New accounts are set to private by default for your privacy. You can change this in your Profile Settings to make your profile visible to others. Public profiles get more connection opportunities."
    },
    {
      question: "What happens if I find spam content in my interactions?",
      answer: "Our system automatically detects and removes spam content. If you encounter any, please report it immediately. Accounts with repeated spam violations will be automatically restricted."
    },
    {
      question: "Can I change my availability after setting it up?",
      answer: "Yes, you can update your availability at any time from your Profile Settings. Keeping this updated helps others know when you're available for skill exchanges."
    },
    {
      question: "How do I delete my account?",
      answer: "Account deletion can be only done through contact us below. Please note this action is permanent and will remove all your data from our system. You'll be asked to confirm this decision multiple times."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <DashboardHeader profilePic={''} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Frequently Asked Questions</h1>
            <p className="text-gray-600">Find answers to common questions about our platform</p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className={`w-full flex justify-between items-center p-5 text-left font-medium hover:bg-gray-50 transition-colors ${
                    activeIndex === index ? 'bg-gray-50' : ''
                  }`}
                >
                  <span className="text-lg text-gray-800">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-blue-500 transition-transform duration-200 ${
                      activeIndex === index ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                <div
                  className={`px-5 pb-5 pt-0 text-gray-600 transition-all duration-200 ${
                    activeIndex === index ? 'block' : 'hidden'
                  }`}
                >
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Still have questions?</h3>
            <p className="text-gray-600 mb-6">Contact our support team for further assistance</p>
            <button
              onClick={() => router.push('mailto:meeketketantank@gmail.com')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}