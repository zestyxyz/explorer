import React, { useEffect, useState } from "react";


export default () => {
  const [initialData, setInitialData] = useState([]);
  const [data, setData] = useState([]);
  const [timeframe, setTimeframe] = useState('visits');
  
  const formatIPFS = uri => {
    if (uri.substring(0, 7) === 'ipfs://')
      uri = `https://ipfs.zesty.market/ipfs/${uri.substring(7)}`;
    else
      uri = `https://ipfs.zesty.market/ipfs/${uri}`;
  }

  useEffect(async () => {
    // GraphQL queries for tokenDatas and beacon data
    const graphQuery = `
    query {
      tokenDatas(first:1000, where: {
        burned: false
      }) {
        id
        uri
      }
    }
    `
    const graphqlQuery = `
    query {
      spaces(first: 1000) {
        spaceId
        analytics {
          visits(first: 1000) {
            count
            date
          }
        }
      }
    }
    `

    // POST request bodies
    const graphBody = {
      query: graphQuery,
      variables: null
    };
    const graphqlBody = {
      query: graphqlQuery,
      variables: null
    };

    // Fetch requests for data
    const graphResponse = await fetch('https://api.thegraph.com/subgraphs/name/zestymarket/zesty-market-graph-matic', {
      method: 'POST',
      body: JSON.stringify(graphBody)
    });
    const graphqlResponse = await fetch('https://beacon2.zesty.market/zgraphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlBody)
    });

    // JSON for fetched data
    const graphJSON = await graphResponse.json();
    const graphqlJSON = await graphqlResponse.json();

    // Grab data from JSON
    let tokenDatas = graphJSON.data.tokenDatas;
    let spaces = graphqlJSON.data.spaces;

    // Filter out spaces with no visit data
    spaces = spaces.filter(space => space.analytics.visits.length > 0);

    // Get separate list of space IDs
    const spaceIds = spaces.map(space => space.spaceId);

    // Accumulate total visits for each space and then sort ascending
    spaces.forEach(space => {
      space.analytics['visitsWeekly'] = space.analytics.visits.reduce((prev, cur) => {
        if (Date.now() - Date.parse(cur.date) > 1000 * 60 * 60 * 24 * 7) return prev; // 1 Week
        return prev + cur.count;
      }, 0);
      space.analytics['visitsMonthly'] = space.analytics.visits.reduce((prev, cur) => {
        if (Date.now() - Date.parse(cur.date) > 1000 * 60 * 60 * 24 * 30) return prev; // 1 month (30 days)
        return prev + cur.count;
      }, 0);
      space.analytics['visitsYearly'] = space.analytics.visits.reduce((prev, cur) => {
        if (Date.now() - Date.parse(cur.date) > 1000 * 60 * 60 * 24 * 365) return prev; // 1 year (365 days)
        return prev + cur.count;
      }, 0);
      space.analytics.visits = space.analytics.visits.reduce((prev, cur) => prev + cur.count, 0);
    });
    spaces.sort((a, b) => +a.spaceId - +b.spaceId);

    // Filter out tokenDatas that don't have beacon data
    tokenDatas = tokenDatas.filter(tokenData => spaceIds.includes(tokenData.id));

    // Get separate list of tokenData IDs
    const tokenDataIds = tokenDatas.map(tokenData => tokenData.id);

    // Filter out burned spaces from beacon data
    spaces = spaces.filter(space => tokenDataIds.includes(space.spaceId));

    // Standardize IPFS URIs in tokenDatas and then sort ascending
    tokenDatas.forEach(tokenData => {
      if (tokenData.uri.substring(0, 7) === 'ipfs://')
        tokenData.uri = `https://ipfs.zesty.market/ipfs/${tokenData.uri.substring(7)}`;
      else
        tokenData.uri = `https://ipfs.zesty.market/ipfs/${tokenData.uri}`;
      //tokenData.uri = formatIPFS(tokenData.uri);
    });
    tokenDatas.sort((a, b) => +a.id - +b.id);

    // Combine tokenData and beacon data
    let combinedSpaceData = tokenDatas.map((tokenData, i) => {
      return {
        id: tokenData.id,
        uri: tokenData.uri,
        visits: spaces[i].analytics.visits,
        visitsWeekly: spaces[i].analytics.visitsWeekly,
        visitsMonthly: spaces[i].analytics.visitsMonthly,
        visitsYearly: spaces[i].analytics.visitsYearly
      }
    });

    // Populate IPFS URI data
    await Promise.all(combinedSpaceData.map(async space => {
      space['data'] = await (await fetch(space.uri)).json();
      if (space.data.image.substring(0, 7) === 'ipfs://')
        space.data.image = `https://ipfs.zesty.market/ipfs/${space.data.image.substring(7)}`;
      else
        space.data.image = `https://ipfs.zesty.market/ipfs/${space.data.image}`;
    }));

    setInitialData(combinedSpaceData);

    // Filter out invalid spaces from the list
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('decentraland'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('cryptojournal'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('google'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('vrch.at'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('https://zesty.market'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('3den'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.format.includes('Twitch'));
    combinedSpaceData.sort((a, b) => b.visits - a.visits);

    setData(combinedSpaceData);
  }, []);

  const sortByWeekly = () => {
    const spaceData = [...data];
    spaceData.sort((a, b) => b.visitsWeekly - a.visitsWeekly);
    setData(spaceData);
    setTimeframe('visitsWeekly');
  }

  const sortByMonthly = () => {
    const spaceData = [...data];
    spaceData.sort((a, b) => b.visitsMonthly - a.visitsMonthly);
    setData(spaceData);
    setTimeframe('visitsMonthly');
  }

  const sortByYearly = () => {
    const spaceData = [...data];
    spaceData.sort((a, b) => b.visitsYearly - a.visitsYearly);
    setData(spaceData);
    setTimeframe('visitsYearly');
  }

  const sortByLifetime = () => {
    const spaceData = [...data];
    spaceData.sort((a, b) => b.visits - a.visits);
    setData(spaceData);
    setTimeframe('visits');
  }

  const filterByWebXR = () => {
    // Filter out invalid spaces from the list
    let combinedSpaceData = [...initialData];
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('decentraland'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('cryptojournal'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('google'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('vrch.at'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('https://zesty.market'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.location.includes('3den'));
    combinedSpaceData = combinedSpaceData.filter(space => !space.data.format.includes('Twitch'));
    combinedSpaceData.sort((a, b) => b.visits - a.visits);

    setData(combinedSpaceData);
  }

  const filterByDecentraland = () => {
    // Filter out invalid spaces from the list
    let combinedSpaceData = [...initialData];
    combinedSpaceData = combinedSpaceData.filter(space => space.data.location.includes('decentraland'));
    combinedSpaceData.sort((a, b) => b.visits - a.visits);

    setData(combinedSpaceData);
  }

  const filterByMuse = () => {
    // Filter out invalid spaces from the list
    let combinedSpaceData = [...initialData];
    combinedSpaceData = combinedSpaceData.filter(space => space.data.location.includes('muse') || space.data.location.includes('chilltube'));
    combinedSpaceData.sort((a, b) => b.visits - a.visits);

    setData(combinedSpaceData);
  }

  const filterByHyperfy = () => {
    // Filter out invalid spaces from the list
    let combinedSpaceData = [...initialData];
    combinedSpaceData = combinedSpaceData.filter(space => space.data.location.includes('hyperfy'));
    combinedSpaceData.sort((a, b) => b.visits - a.visits);

    setData(combinedSpaceData);    
  }

  const filterByOther = () => {
    let combinedSpaceData = [...initialData];
    combinedSpaceData = combinedSpaceData.filter(space => {
      return space.data.location.includes('cryptojournal') ||
             space.data.location.includes('google') ||
             space.data.location.includes('vrch.at') ||
             space.data.location.includes('https://zesty.market') ||
             space.data.location.includes('3den') ||
             space.data.format.includes('Twitch')
    });
    combinedSpaceData.sort((a, b) => b.visits - a.visits);

    setData(combinedSpaceData);
  }

  const showAll = () => {
    let combinedSpaceData = [...initialData];
    combinedSpaceData.sort((a, b) => b.visits - a.visits);

    setData(combinedSpaceData);
  }

  return (
    <>
      <div id="header">
        <a id="discord" style={{float: 'right'}} href='https://discord.com/invite/4tcveDjBuD'>
          <img src="discord-white.png" width={'32px'}></img>
        </a>
        <h1>Zesty Metaverse Directory</h1>
        <div id="filter">
          <span onClick={showAll}>Show All Spaces</span>
          <span onClick={filterByWebXR}>WebXR</span>
          <span onClick={filterByHyperfy}>Hyperfy</span> 
          <span onClick={filterByDecentraland}>Decentraland</span>
          <span onClick={filterByMuse}>Muse</span>
          <span onClick={filterByOther}>Other</span>
        </div>
        <div id="sort">
          <span onClick={sortByWeekly}>Sort by Weekly Visits</span>
          <span onClick={sortByMonthly}>Monthly</span>
          <span onClick={sortByYearly}>Yearly</span>
          <span onClick={sortByLifetime}>Lifetime</span>
        </div>
      </div>
      <div>
        <span>These are spaces that have integrated the Zesty SDK</span>
      </div>
      <div id="cards">
        {data && data.map(space => (
          <div className={'card'} style={{display: 'inline-block'}} key={space.id}>
            <img src={space.data.image} width={'100%'} />
            <p><b>{space.data.name}</b></p>
            <p><a href={space.data.location} target={'_blank'}>Visit</a></p>
            <p><a href={`https://app.zesty.market/space/${space.id}`} target={'_blank'}>View on market</a></p>
            <p>Visits: {space[timeframe]}</p>
          </div>
        ))}
      </div>
    </>
  )
};
