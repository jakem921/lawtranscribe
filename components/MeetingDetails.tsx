"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CheckCircle,
  Flag,
  AlertCircle,
  Lightbulb,
  Calendar,
  Users,
  List,
  AlertTriangle,
  FileText,
  Download,
  MessageCircle,
  Send,
} from "lucide-react"
import CategoryCard from "@/components/CategoryCard"
import axios from "axios"
import { useToast } from "@/hooks/use-toast"

interface CategoryItem {
  [key: string]: string
}

interface MeetingDetailsProps {
  data: {
    id: string
    name: string
    description: string
    transcript: string
    summary: string
    breakdown: {
      Tasks: { task: string; owner: string; due_date: string }[]
      Decisions: { decision: string; details: string }[]
      Questions: { question: string; status: string; answer?: string }[]
      Insights: { insight: string; reference: string }[]
      Deadlines: { deadline: string; related_to: string }[]
      Attendees: { name: string; role: string }[]
      "Follow-ups": { follow_up: string; owner: string; due_date: string }[]
      Risks: { risk: string; impact: string }[]
    }
  }
}

interface AnalysisContent {
  title: string;
  description: string;
  summary: string;
  tasks: string[];
  decisions: string[];
  questions: string[];
  insights: string[];
  deadlines: string[];
  speakers: string[];
  timeline: string[];
  keystatements: string[];
  followups: string[];
  risks: string[];
  agenda: string[];
}

interface AnalysisResponse {
  choices: [{
    message: {
      content: AnalysisContent;
    };
  }];
}

interface Conversation {
  id: string;
  createdAt: string;
  messages: Array<{ role: 'user' | 'assistant', content: string }>;
}

export default function MeetingDetails({ data }: MeetingDetailsProps) {
  const { toast } = useToast()
  const [selectedAnalysis, setSelectedAnalysis] = React.useState<string | null>(null)
  const [analysisOutput, setAnalysisOutput] = React.useState<string>('Analysis output will appear here...')
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [message, setMessage] = React.useState<string>('')
  const [chatHistory, setChatHistory] = React.useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const chatEndRef = React.useRef<HTMLDivElement>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  // Load chat history when component mounts
  React.useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const response = await axios.get(`/api/chat/history/${data.id}`)
        if (response.data.conversation) {
          setConversationId(response.data.conversation.id)
          setChatHistory(response.data.conversation.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content
          })))
        }
      } catch (error: any) {
        console.error('Error loading chat history:', error)
        toast({
          title: "Error",
          description: "Failed to load chat history.",
          variant: "destructive",
        })
      }
    }

    loadChatHistory()
  }, [data.id, toast])

  // Load all conversations for this meeting
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const response = await axios.get(`/api/chat/conversations/${data.id}`)
        setConversations(response.data.conversations)
        if (response.data.conversations.length > 0) {
          setSelectedConversationId(response.data.conversations[0].id)
          setConversationId(response.data.conversations[0].id)
          setChatHistory(response.data.conversations[0].messages)
        }
      } catch (error: any) {
        console.error('Error loading conversations:', error)
        toast({
          title: "Error",
          description: "Failed to load conversations.",
          variant: "destructive",
        })
      }
    }

    loadConversations()
  }, [data.id])

  const categories = [
    { title: "Tasks", icon: CheckCircle, items: data.breakdown.Tasks || [], gridSpan: "col-span-2" },
    { title: "Decisions", icon: Flag, items: data.breakdown.Decisions || [], gridSpan: "col-span-2" },
    { title: "Questions", icon: AlertCircle, items: data.breakdown.Questions || [], gridSpan: "col-span-2" },
    { title: "Insights", icon: Lightbulb, items: data.breakdown.Insights || [], gridSpan: "col-span-2" },
    { title: "Deadlines", icon: Calendar, items: data.breakdown.Deadlines || [], gridSpan: "col-span-1" },
    { title: "Attendees", icon: Users, items: data.breakdown.Attendees || [], gridSpan: "col-span-1" },
    { title: "Follow-ups", icon: List, items: data.breakdown["Follow-ups"] || [], gridSpan: "col-span-2" },
    { title: "Risks", icon: AlertTriangle, items: data.breakdown.Risks || [], gridSpan: "col-span-2" },
  ]

  const analysisTypes = [
    {
      id: 'coercion',
      title: 'Coercion & Duress Analysis',
      description: 'Identify signs of coercion, duress, pressure, and proper Miranda rights handling'
    },
    {
      id: 'keyphrases',
      title: 'Self-Incrimination & Key Admissions Analysis',
      description: 'Identify potentially self-incriminating statements, key admissions, and legally significant statements'
    },
    {
      id: 'timeline',
      title: 'Timeline Analysis',
      description: 'Track legal procedures, rights readings, detainment periods, and identify any procedural gaps'
    },
    {
      id: 'speakers',
      title: 'Power Dynamics & Speaker Influence Analysis',
      description: 'Analyze power dynamics, leading questions, and changes in statements under pressure'
    }
  ]

  const analysisCategories = [
    { title: "Tasks", icon: CheckCircle, gridSpan: "col-span-2" },
    { title: "Decisions", icon: Flag, gridSpan: "col-span-2" },
    { title: "Questions", icon: AlertCircle, gridSpan: "col-span-2" },
    { title: "Insights", icon: Lightbulb, gridSpan: "col-span-2" },
    { title: "Deadlines", icon: Calendar, gridSpan: "col-span-1" },
    { title: "Speakers", icon: Users, gridSpan: "col-span-1" },
    { title: "Timeline", icon: List, gridSpan: "col-span-2" },
    { title: "Key Statements", icon: MessageCircle, gridSpan: "col-span-2" },
    { title: "Follow-ups", icon: List, gridSpan: "col-span-2" },
    { title: "Risks", icon: AlertTriangle, gridSpan: "col-span-2" },
    { title: "Agenda", icon: FileText, gridSpan: "col-span-2" }
  ]

  const [analysisData, setAnalysisData] = React.useState<AnalysisContent | null>(null);

  const handleAnalysisSelect = (id: string) => {
    setSelectedAnalysis(id)
  }

  const handleRunAnalysis = async () => {
    if (!selectedAnalysis) {
      toast({
        title: "No Analysis Selected",
        description: "Please select an analysis type first.",
        variant: "destructive",
      })
      return
    }

    setIsAnalyzing(true)
    setAnalysisData(null)

    try {
      const response = await axios.post('/api/analyze', {
        transcript: data.transcript,
        analysisType: selectedAnalysis
      })

      const content = response.data.choices[0].message.content;
      setAnalysisData(content);
      
      toast({
        title: "Analysis Complete",
        description: "The analysis has been generated successfully.",
      })
    } catch (error: any) {
      console.error('Analysis error:', error)
      setAnalysisData(null)
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate analysis.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleExport = async () => {
    try {
      const response = await axios.get(`/api/meetings/${data.id}/export`, {
        responseType: 'blob',
      })

      if (response.status === 200) {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `${data.name.replace(/\s+/g, '_')}_Details.docx`)
        document.body.appendChild(link)
        link.click()
        link.parentNode?.removeChild(link)
        toast({
          title: "Success",
          description: "Meeting details exported successfully!",
        })
      }
    } catch (error: any) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to export meeting details.",
        variant: "destructive",
      })
    }
  }

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [chatHistory])

  const handleSendMessage = async () => {
    if (!message.trim()) return

    const userMessage = message.trim()
    setMessage('')
    setIsLoading(true)

    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const response = await axios.post('/api/chat', {
        meetingId: data.id,
        message: userMessage,
        conversationId: conversationId
      })

      // Store the conversation ID if it's a new conversation
      if (response.data.metadata?.conversation_id) {
        setConversationId(response.data.metadata.conversation_id)
      }

      // Add assistant's response to chat history
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.response 
      }])
    } catch (error: any) {
      console.error('Chat error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to get response.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const startNewConversation = () => {
    setSelectedConversationId(null)
    setConversationId(null)
    setChatHistory([])
  }

  const selectConversation = (conversation: Conversation) => {
    setSelectedConversationId(conversation.id)
    setConversationId(conversation.id)
    setChatHistory(conversation.messages)
  }

  return (
    <div className="container mx-auto p-6 bg-background">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">{data.name}</h1>
        <button
          onClick={handleExport}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Download className="w-5 h-5 mr-2" />
          Export as DOCX
        </button>
      </div>
      <p className="text-muted-foreground mb-6">{data.description}</p>
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="analyze">Analyze</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span>Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{data.summary}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span>Transcript</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{data.transcript}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="details">
          <div className="grid grid-cols-4 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={category.title}
                className={category.gridSpan}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <CategoryCard
                  title={category.title}
                  items={category.items}
                  gridSpan={category.gridSpan}
                />
              </motion.div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="analyze">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span>Analysis Tools</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {analysisTypes.map((type) => (
                    <Card 
                      key={type.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedAnalysis === type.id ? 'bg-accent border-blue-500' : 'hover:bg-accent'
                      }`}
                      onClick={() => handleAnalysisSelect(type.id)}
                    >
                      <h3 className="font-semibold mb-2">{type.title}</h3>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </Card>
                  ))}
                </div>
                <div className="mt-6 space-y-4">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzing || !selectedAnalysis}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                  </Button>
                  {analysisData && (
                    <>
                      <Card className="p-4">
                        <CardHeader>
                          <CardTitle>{analysisData.title}</CardTitle>
                          <CardDescription>{analysisData.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="prose prose-sm dark:prose-invert">
                              <h3>Summary</h3>
                              <p>{analysisData.summary}</p>
                            </div>
                            <div className="mt-4">
                              <h3 className="text-lg font-semibold mb-2">Raw Analysis Output</h3>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-auto max-h-[600px] whitespace-pre-wrap">
                                {JSON.stringify(analysisData, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="chat">
          <div className="grid grid-cols-12 gap-4 h-[800px]">
            {/* Conversation Sidebar */}
            <Card className="col-span-3 h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Conversations</span>
                  <Button 
                    onClick={startNewConversation}
                    variant="outline"
                    size="sm"
                  >
                    New Chat
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[700px]">
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-3 rounded-lg cursor-pointer hover:bg-accent ${
                          selectedConversationId === conv.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => selectConversation(conv)}
                      >
                        <p className="font-medium truncate">
                          {conv.messages[0]?.content.slice(0, 30)}...
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="col-span-9 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  <span>Chat with the Transcript</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col h-[700px]">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4">
                      {chatHistory.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex ${
                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 dark:bg-gray-800">
                            <p>Thinking...</p>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="mt-4 flex gap-2">
                    <Input
                      placeholder="Ask a question about the transcript..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={isLoading || !message.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
