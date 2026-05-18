// api/market.js
export default async function handler(req, res) {
    const chartSymbols = ['^IXIC', '^NDX', '^GSPC', '^SPXEW', 'CNH=X'];
    const stockSymbols = ['NFLX', 'NVDA', 'AAPL', 'MSFT', 'AVGO', 'TSM', 'LITE', 'GOOGL', 'GLW', 'VIAV', 'WDC', 'MU', 'AEIS', 'TER'];
    
    const result = { indices: {}, stocks: {} };

    // 【核心修复】伪装成正常的 Chrome 浏览器，防止被 Yahoo 拦截
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
    };

    try {
        await Promise.all(chartSymbols.map(async (symbol) => {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`, { headers });
            const data = await response.json();
            
            if (!data.chart.result) return; // 容错：如果没有数据直接跳过
            
            const chart = data.chart.result[0];
            const timestamps = chart.timestamp || [];
            const quote = chart.indicators.quote[0];
            
            // 容错：有些分钟没有交易，数据会是 null，我们倒序查找最新有效价格
            let currentPrice = chart.meta.regularMarketPrice;
            if (!currentPrice && quote.close) {
                for(let i = quote.close.length - 1; i >= 0; i--) {
                    if(quote.close[i] !== null) { currentPrice = quote.close[i]; break; }
                }
            }

            const prevClose = chart.meta.chartPreviousClose;
            const changePercent = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

            const klineData = timestamps.map((t, index) => {
                if (quote.close[index] === null) return null;
                const date = new Date(t * 1000);
                const timeStr = date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' });
                return [timeStr, quote.open[index], quote.close[index], quote.low[index], quote.high[index]];
            }).filter(item => item !== null);

            result.indices[symbol] = { price: currentPrice.toFixed(2), change: changePercent.toFixed(2), trend: klineData };
        }));

        if (stockSymbols.length > 0) {
            const quoteRes = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${stockSymbols.join(',')}`, { headers });
            const quoteData = await quoteRes.json();
            if (quoteData.quoteResponse && quoteData.quoteResponse.result) {
                quoteData.quoteResponse.result.forEach(quote => {
                    result.stocks[quote.symbol] = {
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChangePercent
                    };
                });
            }
        }

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
        res.status(200).json({
            updateTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
            data: result
        });
    } catch (error) {
        // 将详细错误抛出，方便排查
        console.error(error);
        res.status(500).json({ error: 'API 请求被拦截或超时' });
    }
}