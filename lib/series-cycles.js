// Pure season-cycle scoring, shared by the Worker and regression tests.
export function averageRatedSeasons(entries) {
  const recent=new Map();
  for(const entry of entries) {
    if(entry.rating==null || !entry.finishedAt)continue;
    const existing=recent.get(entry.seasonNumber);
    if(!existing || entry.finishedAt>existing.finishedAt ||
      (entry.finishedAt===existing.finishedAt && entry.startedAt>existing.startedAt) ||
      (entry.finishedAt===existing.finishedAt && entry.startedAt===existing.startedAt && entry.id>existing.id)){
      recent.set(entry.seasonNumber,entry);
    }
  }
  const ratings=[...recent.values()].map(item=>item.rating);
  const average=ratings.length ? Math.round((ratings.reduce((sum,value)=>sum+value,0)/ratings.length+Number.EPSILON)*10)/10 : null;
  return {average,ratedSeasons:ratings.length};
}
