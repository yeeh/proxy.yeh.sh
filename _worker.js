
// 默认优选地址，不带端口号默认443，不支持非TLS订阅生成
let addresses = [];

// 设置优选地址api接口
let addressesapi = [
    'https://vless-4ca.pages.dev/sub?host=123.workers.dev&uuid=aaa&edgetunnel=cmliu&proxyip=true' //可参考内容格式 自行搭建。
];

let link = '';

let SUBUpdateTime = 6;
let total = 99;//PB
//let timestamp = now;
let timestamp = 4102329600000;//2099-12-31

function decodeAndExtract(text) {
    // 使用 `atob()` 函数进行 base64 解码
    const decodedText = atob(text);

    // 按行拆分文本
    const lines = decodedText.split('\n');

    const results = [];

    for (const line of lines) {
        // 对每一行进行 decodeURIComponent 解码
        const decodedLine = decodeURIComponent(line);
        const temp = []

        // 匹配 @ 和第一个 ? 之间的內容
        const match1 = decodedLine.match(/@(.*?)\?/);
        if (match1) {
            temp.push(match1[1]);
        }

        // 匹配 # 之后的内容
        const match2 = decodedLine.match(/#(.*)$/);
        if (match2) {
            temp.push(match2[1].replace(" 已启用临时域名中转服务，请尽快绑定自定义域！",""));
        }

        results.push(temp.join("#"))
    }

    // 按行组合输出，并去除空行
    const output = results.filter(line => line).map(line => `${line}`).join('\n');
    return output;
}



async function getAddressesapi(cdn) {
    if(!!cdn){
        addressesapi = [
            cdn
        ];
    }

    let newAddressesapi = [];

    for (const apiUrl of addressesapi) {
        try {
            const response = await fetch(apiUrl);

            if (!response.ok) {
                console.error('获取地址时出错:', response.status, response.statusText);
                continue;
            }

            let text = await response.text();
            text = decodeAndExtract(text)
            let lines;
            if (text.includes('\r\n')){
                lines = text.split('\r\n');
            } else {
                lines = text.split('\n');
            }
            const regex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(#.*)?$/;

            const apiAddresses = lines.map(line => {
                const match = line.match(regex);
                return match ? match[0] : null;
            }).filter(Boolean);

            newAddressesapi = newAddressesapi.concat(apiAddresses);
        } catch (error) {
            console.error('获取地址时出错:', error);
            continue;
        }
    }

    return newAddressesapi;
}


let protocol;
export default {
    async fetch (request, env) {

        const userAgentHeader = request.headers.get('User-Agent');

        const url = new URL(request.url);

        let host = url.searchParams.get('host');
        let sni = url.searchParams.get('sni') || host;
        let uuid = url.searchParams.get('uuid');
        let path = url.searchParams.get('path');
        let prefix = url.searchParams.get('prefix');
        let cdn = url.searchParams.get('cdn');
        let UD = Math.floor(((timestamp - Date.now())/timestamp * 99 * 1099511627776 * 1024)/2);
        total = total * 1099511627776 * 1024;
        let expire= Math.floor(timestamp / 1000) ;

            if (!url.pathname.includes("/sub")) {
                const responseText = `

			路径必须包含 "/sub"
			
			${url.origin}/sub?host=[your host]&uuid=[your uuid]&path=[your path]
			
				`;

                return new Response(responseText, {
                    status: 400,
                    headers: { 'content-type': 'text/plain; charset=utf-8' },
                });
            }

            if (!host || !uuid) {
                const responseText = `
			缺少必填参数：host 和 uuid
			
			
			${url.origin}/sub?host=[your host]&uuid=[your uuid]&path=[your path]
			
			
				`;

                return new Response(responseText, {
                    status: 400,
                    headers: { 'content-type': 'text/plain; charset=utf-8' },
                });
            }


            const newAddressesapi = await getAddressesapi(cdn);
            addresses = addresses.concat(newAddressesapi);

            // 使用Set对象去重
            const uniqueAddresses = [...new Set(addresses)];

            let index = 0;

            const responseBody = uniqueAddresses.map(address => {
                index += 1;
                let port = "443";
                let addressid = address;

                if (address.includes(':') && address.includes('#')) {
                    const parts = address.split(':');
                    address = parts[0];
                    const subParts = parts[1].split('#');
                    port = subParts[0];
                    addressid = subParts[1];
                } else if (address.includes(':')) {
                    const parts = address.split(':');
                    address = parts[0];
                    port = parts[1];
                } else if (address.includes('#')) {
                    const parts = address.split('#');
                    address = parts[0];
                    addressid = parts[1];
                }

                if (addressid.includes(':')) {
                    addressid = addressid.split(':')[0];
                }

                return  `${prefix + addressid + index} = vmess, ${address}, ${port}, username=${uuid}, ws-path=${path}, ws-headers=Host:"${host}", sni=${sni}, skip-cert-verify=true, ws=true, vmess-aead=true, tls=true`;

            }).join('\n');


            return new Response(responseBody, {
                headers: {
                    //"Content-Disposition": `attachment; filename*=utf-8''${encodeURIComponent(FileName)}; filename=${FileName}`,
                    "content-type": "text/plain; charset=utf-8",
                    "Profile-Update-Interval": `${SUBUpdateTime}`,
                    "Subscription-Userinfo": `upload=${UD}; download=${UD}; total=${total}; expire=${expire}`,
                },
            });


    }
};
