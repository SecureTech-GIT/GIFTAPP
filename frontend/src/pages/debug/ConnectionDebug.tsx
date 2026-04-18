import { useState } from 'react'
import { config } from '@/config/environment'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, Loader2, RefreshCw, Key } from 'lucide-react'
import axios from 'axios'

interface TestResult {
  endpoint: string
  status: 'idle' | 'loading' | 'success' | 'error'
  statusCode?: number
  message?: string
  responseUrl?: string
}

const getTokenAuth = () => {
  const apiKey = localStorage.getItem('frappe_api_key')
  const apiSecret = localStorage.getItem('frappe_api_secret')
  return apiKey && apiSecret ? { apiKey, apiSecret } : null
}

const setTokenAuth = (apiKey: string, apiSecret: string) => {
  localStorage.setItem('frappe_api_key', apiKey)
  localStorage.setItem('frappe_api_secret', apiSecret)
}

const clearTokenAuth = () => {
  localStorage.removeItem('frappe_api_key')
  localStorage.removeItem('frappe_api_secret')
}

export default function ConnectionDebug() {
  const [tests, setTests] = useState<TestResult[]>([
    { endpoint: '/api/method/frappe.auth.get_logged_user', status: 'idle' },
    { endpoint: '/api/resource/Gift?fields=["name"]&limit_page_length=1', status: 'idle' },
    { endpoint: '/api/resource/Gift%20Category?fields=["name"]&limit_page_length=1', status: 'idle' },
  ])
  const [isRunning, setIsRunning] = useState(false)
  
  // Token auth state
  const existingToken = getTokenAuth()
  const [apiKey, setApiKey] = useState(existingToken?.apiKey || '')
  const [apiSecret, setApiSecret] = useState(existingToken?.apiSecret || '')
  const [tokenSaved, setTokenSaved] = useState(!!existingToken)

  const runTests = async () => {
    setIsRunning(true)
    
    const newTests = [...tests]
    
    for (let i = 0; i < newTests.length; i++) {
      newTests[i] = { ...newTests[i], status: 'loading' }
      setTests([...newTests])
      
      try {
        const headers: Record<string, string> = {}
        const token = getTokenAuth()
        if (token) {
          headers['Authorization'] = `token ${token.apiKey}:${token.apiSecret}`
        }
        
        const response = await axios.get(`${config.apiBaseUrl}${newTests[i].endpoint}`, {
          withCredentials: true,
          headers,
          params: { _t: Date.now() }
        })
        
        newTests[i] = {
          ...newTests[i],
          status: 'success',
          statusCode: response.status,
          message: JSON.stringify(response.data).slice(0, 100) + '...',
          responseUrl: response.request?.responseURL || 'N/A'
        }
      } catch (error: any) {
        newTests[i] = {
          ...newTests[i],
          status: 'error',
          statusCode: error.response?.status,
          message: error.response?.data?.exception || error.message,
          responseUrl: error.request?.responseURL || 'N/A'
        }
      }
      
      setTests([...newTests])
    }
    
    setIsRunning(false)
  }

  const handleSaveToken = () => {
    if (apiKey && apiSecret) {
      setTokenAuth(apiKey, apiSecret)
      setTokenSaved(true)
    }
  }

  const handleClearToken = () => {
    clearTokenAuth()
    setApiKey('')
    setApiSecret('')
    setTokenSaved(false)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Connection Debug</h1>
        <p className="text-muted-foreground">Diagnose API connectivity and authentication issues</p>
      </div>

      {/* Environment Info */}
      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>Current configuration values</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">window.location.origin:</span>
            <span>{window.location.origin}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">config.apiBaseUrl:</span>
            <span>{config.apiBaseUrl || '(empty - using relative URLs)'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">config.isDevelopment:</span>
            <span>{config.isDevelopment ? 'true' : 'false'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cached User:</span>
            <span>{localStorage.getItem('frappe_user') || '(none)'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token Auth:</span>
            <Badge variant={tokenSaved ? 'default' : 'secondary'}>
              {tokenSaved ? 'Configured' : 'Not Set'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Token Auth Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Token Authentication
          </CardTitle>
          <CardDescription>
            Use API Key/Secret for authentication (bypasses cookie issues)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="text"
                placeholder="e.g., a1b2c3d4e5f6g7h8"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret</Label>
              <Input
                id="apiSecret"
                type="password"
                placeholder="e.g., x9y8z7w6v5u4t3s2"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveToken} disabled={!apiKey || !apiSecret}>
              Save Token
            </Button>
            <Button variant="outline" onClick={handleClearToken} disabled={!tokenSaved}>
              Clear Token
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Generate an API key in Frappe: User Settings → API Access → Generate Keys
          </p>
        </CardContent>
      </Card>

      {/* API Tests */}
      <Card>
        <CardHeader>
          <CardTitle>API Connectivity Tests</CardTitle>
          <CardDescription>Test endpoints to verify authentication and routing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runTests} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Tests
              </>
            )}
          </Button>

          <div className="space-y-3">
            {tests.map((test, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    GET {test.endpoint}
                  </code>
                  <div className="flex items-center gap-2">
                    {test.status === 'idle' && <Badge variant="secondary">Idle</Badge>}
                    {test.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {test.status === 'success' && (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <Badge variant="default">{test.statusCode}</Badge>
                      </>
                    )}
                    {test.status === 'error' && (
                      <>
                        <XCircle className="h-4 w-4 text-destructive" />
                        <Badge variant="destructive">{test.statusCode || 'Error'}</Badge>
                      </>
                    )}
                  </div>
                </div>
                {test.responseUrl && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Response URL:</span> {test.responseUrl}
                  </div>
                )}
                {test.message && (
                  <div className="text-xs font-mono bg-muted p-2 rounded overflow-auto">
                    {test.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>403 PermissionError:</strong> Session cookie not being sent. Use API Token auth above.</p>
          <p><strong>401 Unauthorized:</strong> Not logged in or session expired. Re-login required.</p>
          <p><strong>Response URL shows backend domain:</strong> Proxy is working correctly.</p>
          <p><strong>Response URL shows frontend domain:</strong> Vite proxy is active (dev mode).</p>
        </CardContent>
      </Card>
    </div>
  )
}
