'use client';
import {QueryClient,QueryClientProvider,QueryCache,MutationCache} from '@tanstack/react-query';
import {useState,type ReactNode} from 'react';
import {FeedbackProvider,RequestActivity,useNotify} from './feedback';
function DataProvider({children}:{children:ReactNode}){
  const notify=useNotify();
  const [client]=useState(()=>new QueryClient({queryCache:new QueryCache({onError:error=>notify(error.message,'error')}),mutationCache:new MutationCache({onError:error=>notify(error.message,'error')}),defaultOptions:{queries:{staleTime:30_000,gcTime:300_000,retry:1,refetchOnWindowFocus:true}}}));
  return <QueryClientProvider client={client}><RequestActivity/>{children}</QueryClientProvider>;
}
export function Providers({children}:{children:ReactNode}){return <FeedbackProvider><DataProvider>{children}</DataProvider></FeedbackProvider>;}
