// api/market.js
export default async function handler(req, res) {
    // 包含了 5 个指标：纳指综合, 纳指100, 标普500, 标普等权, 离岸人民币
    const symbols = ['^IXIC', '^NDX', '^GSPC', '^SPXEW', 'CNH=X'];
    const result = {};

    try {
        await Promise.all(symbols.map(async (symbol) => {
            // 核心改变：获取当天的 5分钟级别 数据（用于画趋势图）
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`);
            const data = await response.json();
            const chart = data.chart.result[0];

            const timestamps = chart.timestamp || [];
            const quote = chart.indicators.quote[0];

            // 提取最新价和昨日收盘价
            const currentPrice = quote.close[quote.close.length - 1];
            const prevClose = chart.meta.chartPreviousClose;
            const changePercent = ((currentPrice - prevClose) / prevClose) * 100;

            // 组装 K 线数据格式: [时间, 开盘, 收盘, 最低, 最高]
            const klineData = timestamps.map((t, index) => {
                // 过滤掉因为休市导致的 null 数据
                if (quote.close[index] === null) return null;
                // 转换时间戳为东八区直观时间格式 (HH:MM)
                const date = new Date(t * 1000);
                const timeStr = date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' });
                return [timeStr, quote.open[index], quote.close[index], quote.low[index], quote.high[index]];
            }).filter(item => item !== null);

            result[symbol] = {
                price: currentPrice.toFixed(2),
                change: changePercent.toFixed(2),
                trend: klineData
            };
        }));

        // 【超级护盾】告诉 Vercel 缓存 60 秒，防止被 Yahoo 限流拉黑
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
        res.status(200).json({
            updateTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
            data: result
        });
    } catch (error) {
        res.status(500).json({ error: '数据获取失败' });
    }
}